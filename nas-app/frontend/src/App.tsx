import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  streamUrlFor,
  type AppSettings,
  type FsListResponse,
  type FsRoot,
  type PlayItem,
  type ScanEntry,
} from "./api/client";
import { RealEngine } from "./engines/realEngine";
import { BandStage } from "./engines/bandStage";
import PlayerView from "./components/PlayerView";
import SettingsView from "./components/SettingsView";
import { noteBus } from "./state/noteBus";

const DEFAULT_SETTINGS: AppSettings = {
  scanFolders: [],
  defaultEngine: "real",
  volume: 0.9,
  lastSongPath: null,
  bitmidiEnabled: true,
  smbShares: [],
};

export default function App() {
  const engineRef = useRef<RealEngine | null>(null);
  const bandRef = useRef<BandStage | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const volumeRef = useRef(0.9);
  // Play queue (for prev/next + auto-advance). Refs avoid stale closures.
  const queueRef = useRef<PlayItem[]>([]);
  const qIdxRef = useRef(-1);
  const endedRef = useRef<() => void>(() => {});

  const [view, setView] = useState<"player" | "settings">("player");
  const [scoreOn, setScoreOn] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [roots, setRoots] = useState<FsRoot[]>([]);
  const [listing, setListing] = useState<FsListResponse | null>(null);
  const [songs, setSongs] = useState<ScanEntry[]>([]);
  const [now, setNow] = useState<{ title: string; path: string } | null>(null);
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(0.9);
  const [progress, setProgress] = useState({ t: 0, d: 0 });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  volumeRef.current = volume;

  // ---- boot -----------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setVersion(h.version);
        const s = await api.settings();
        setSettings(s);
        setVolume(s.volume);
        const r = await api.roots();
        setRoots(r);
        if (r.length) setListing(await api.list(r[0].path));
        if (!window.isSecureContext) {
          setError(
            "⚠ HTTPS(보안 컨텍스트)가 아닙니다 — 오디오 재생이 안 될 수 있습니다. " +
              "HTTPS로 접속하세요. (원격 HTTP는 브라우저가 AudioWorklet을 막습니다)",
          );
        }
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  // ---- band stage (created once the canvas is mounted) ----------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && !bandRef.current) {
      bandRef.current = new BandStage(canvas);
      bandRef.current.start();
      (window as unknown as { __band?: BandStage }).__band = bandRef.current;
    }
    // Tap the stage to lay down a beat: left half = basic drum kit, right half =
    // DJ / FX hits. Position picks the drum; a colored sound-wave marks the hit.
    const onClick = (ev: MouseEvent) => {
      const band = bandRef.current;
      const eng = engineRef.current;
      if (!band || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      const leftHalf = x < canvas.width / 2;
      eng?.playDrum(drumForClick(x, y, canvas.width, canvas.height));
      band.addRipple(x, y, leftHalf ? 195 : 315);
    };
    canvas?.addEventListener("click", onClick);
    return () => {
      canvas?.removeEventListener("click", onClick);
      bandRef.current?.dispose();
      bandRef.current = null;
    };
  }, []);

  // ---- transport clock ------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const eng = engineRef.current;
      if (eng) setProgress({ t: eng.currentTime, d: eng.duration });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const getTime = useCallback(() => engineRef.current?.currentTime ?? 0, []);

  const engine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new RealEngine({
        onNote: (e) => {
          bandRef.current?.onNote(e);
          noteBus.emit(e); // drives the piano keyboard visualizer
        },
        onEnded: () => endedRef.current(),
      });
      engineRef.current.setVolume(volumeRef.current);
    }
    return engineRef.current;
  }, []);

  const navigate = useCallback(async (path: string) => {
    setError(null);
    try {
      setListing(await api.list(path));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const scan = useCallback(async () => {
    if (!listing) return;
    setBusy(true);
    setError(null);
    try {
      setSongs(await api.scan(listing.path));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [listing]);

  const playItem = useCallback(
    async (item: PlayItem) => {
      setError(null);
      setBusy(true);
      try {
        const url = streamUrlFor(item);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`stream ${res.status}`);
        const buf = await res.arrayBuffer();
        bandRef.current?.reset();
        bandRef.current?.setSong(item.title);
        setStreamUrl(url);
        await engine().play(buf, item.title);
        setNow({ title: item.title, path: item.id });
        setPaused(false);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [engine],
  );

  // Play item[index] and remember the whole list as the queue (prev/next).
  const playQueue = useCallback(
    (items: PlayItem[], index: number) => {
      queueRef.current = items;
      qIdxRef.current = index;
      if (items[index]) playItem(items[index]);
    },
    [playItem],
  );

  const playAdjacent = useCallback(
    (delta: number) => {
      const q = queueRef.current;
      const ni = qIdxRef.current + delta;
      if (ni < 0 || ni >= q.length) return;
      qIdxRef.current = ni;
      playItem(q[ni]);
    },
    [playItem],
  );

  // When a song ends: auto-advance to the next, or stop at the end.
  endedRef.current = () => {
    const q = queueRef.current;
    const ni = qIdxRef.current + 1;
    if (ni < q.length) {
      qIdxRef.current = ni;
      playItem(q[ni]);
    } else {
      setPaused(true);
    }
  };

  const togglePlay = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !now) return;
    if (eng.paused) {
      eng.resume();
      setPaused(false);
    } else {
      eng.pause();
      setPaused(true);
    }
  }, [now]);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const eng = engineRef.current;
    if (!eng || !eng.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    eng.currentTime = frac * eng.duration;
  }, []);

  const saveSettings = useCallback(async (s: AppSettings) => {
    setError(null);
    try {
      const saved = await api.saveSettings(s);
      setSettings(saved);
      changeVolume(saved.volume);
      const r = await api.roots();
      setRoots(r);
      setListing(r.length ? await api.list(r[0].path) : null);
    } catch (e) {
      setError(String(e));
    }
  }, [changeVolume]);

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🎵 MIDI Ani Player</span>
        <nav className="tabs">
          <button className={view === "player" ? "on" : ""} onClick={() => setView("player")}>
            ▶ 재생
          </button>
          <button className={view === "settings" ? "on" : ""} onClick={() => setView("settings")}>
            ⚙ 설정
          </button>
        </nav>
        {view === "player" && (
          <button className={"scoretoggle " + (scoreOn ? "on" : "")} onClick={() => setScoreOn((v) => !v)}>
            🎼 악보보기
          </button>
        )}
        <span className="ver">v{version || "…"}</span>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="body">
        <PlayerView
          hidden={view !== "player"}
          roots={roots}
          listing={listing}
          songs={songs}
          nowPath={now?.path ?? null}
          busy={busy}
          bandCanvasRef={canvasRef}
          onNavigate={navigate}
          onScan={scan}
          onPlayQueue={playQueue}
          scoreOn={scoreOn}
          streamUrl={streamUrl}
          getTime={getTime}
        />
        <SettingsView hidden={view !== "settings"} settings={settings} onSave={saveSettings} />
      </main>

      <footer className="transport">
        <button className="tbtn" title="이전 곡" onClick={() => playAdjacent(-1)} disabled={!now}>
          ⏮
        </button>
        <button className="play" onClick={togglePlay} disabled={!now}>
          {paused ? "▶" : "⏸"}
        </button>
        <button className="tbtn" title="다음 곡" onClick={() => playAdjacent(1)} disabled={!now}>
          ⏭
        </button>
        <div className="np">
          <div className="title">{now?.title ?? "재생 중인 곡 없음"}</div>
          <div className="bar seekable" onClick={seek}>
            <div
              className="fill"
              style={{ width: progress.d ? `${(progress.t / progress.d) * 100}%` : "0%" }}
            />
          </div>
          <div className="time">
            {fmt(progress.t)} / {fmt(progress.d)}
          </div>
        </div>
        <label className="vol">
          🔊
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
          />
        </label>
      </footer>
    </div>
  );
}

// GM drum notes. A 3-col × 2-row pad grid per half. Left = standard kit,
// right = DJ / FX (GS scratch 29/30, cymbals, china, ride, clap).
const DRUM_KIT = [42, 46, 49, 36, 38, 45]; // top: closed-hat, open-hat, crash · bottom: kick, snare, tom
const DRUM_DJ = [29, 30, 55, 52, 51, 39]; // top: scratch-push, scratch-pull, splash · bottom: china, ride, clap

/** Click position → a GM drum note (which half + which pad). */
function drumForClick(x: number, y: number, w: number, h: number): number {
  const leftHalf = x < w / 2;
  const localX = leftHalf ? x / (w / 2) : (x - w / 2) / (w / 2); // 0..1 within half
  const col = Math.max(0, Math.min(2, Math.floor(localX * 3)));
  const row = y < h / 2 ? 0 : 1;
  const pads = leftHalf ? DRUM_KIT : DRUM_DJ;
  return pads[row * 3 + col];
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
