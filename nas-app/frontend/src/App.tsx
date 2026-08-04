import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AppSettings, type FsListResponse, type FsRoot, type ScanEntry } from "./api/client";
import { RealEngine } from "./engines/realEngine";
import { BandStage } from "./engines/bandStage";
import PlayerView from "./components/PlayerView";
import SettingsView from "./components/SettingsView";

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
    if (canvasRef.current && !bandRef.current) {
      bandRef.current = new BandStage(canvasRef.current);
      bandRef.current.start();
      (window as unknown as { __band?: BandStage }).__band = bandRef.current;
    }
    return () => {
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
        onNote: (e) => bandRef.current?.onNote(e),
        onEnded: () => setPaused(true),
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

  const play = useCallback(
    async (title: string, path: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(api.streamUrl(path));
        if (!res.ok) throw new Error(`stream ${res.status}`);
        const buf = await res.arrayBuffer();
        bandRef.current?.reset();
        bandRef.current?.setSong(title);
        setStreamUrl(api.streamUrl(path));
        await engine().play(buf, title);
        setNow({ title, path });
        setPaused(false);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [engine],
  );

  const playBitmidi = useCallback(
    async (title: string, url: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(api.bitmidiFileUrl(url));
        if (!res.ok) throw new Error(`bitmidi ${res.status}`);
        const buf = await res.arrayBuffer();
        bandRef.current?.reset();
        bandRef.current?.setSong(title);
        setStreamUrl(api.bitmidiFileUrl(url));
        await engine().play(buf, title);
        setNow({ title, path: url });
        setPaused(false);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [engine],
  );

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
          onPlay={play}
          onPlayBitmidi={playBitmidi}
          scoreOn={scoreOn}
          streamUrl={streamUrl}
          getTime={getTime}
        />
        <SettingsView hidden={view !== "settings"} settings={settings} onSave={saveSettings} />
      </main>

      <footer className="transport">
        <button className="play" onClick={togglePlay} disabled={!now}>
          {paused ? "▶" : "⏸"}
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

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
