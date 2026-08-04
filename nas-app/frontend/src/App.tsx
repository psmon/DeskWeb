import { useCallback, useEffect, useRef, useState } from "react";
import { api, type FsListResponse, type FsRoot, type ScanEntry } from "./api/client";
import { RealEngine } from "./engines/realEngine";

// Milestone 0 walking skeleton: browse a NAS folder, scan for MIDI files, and
// play a selected file through the local SpessaSynth (real) engine. Band
// animation, score view, jukebox skin, BitMidi and settings UI come next.

interface NowPlaying {
  title: string;
  path: string;
}

export default function App() {
  const engineRef = useRef<RealEngine | null>(null);

  const [version, setVersion] = useState("");
  const [roots, setRoots] = useState<FsRoot[]>([]);
  const [listing, setListing] = useState<FsListResponse | null>(null);
  const [songs, setSongs] = useState<ScanEntry[]>([]);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(0.9);
  const [progress, setProgress] = useState({ t: 0, d: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ---- boot: health + roots + first listing --------------------------------
  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setVersion(h.version);
        const r = await api.roots();
        setRoots(r);
        if (r.length) setListing(await api.list(r[0].path));
        else setError("설정된 접근 폴더(MIDI_ROOTS)가 없습니다.");
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  // ---- progress ticker -----------------------------------------------------
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

  const engine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new RealEngine({
        onEnded: () => setPaused(true),
      });
      engineRef.current.setVolume(volume);
    }
    return engineRef.current;
  }, [volume]);

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

  const playPath = useCallback(
    async (title: string, path: string) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(api.streamUrl(path));
        if (!res.ok) throw new Error(`stream ${res.status}`);
        const buf = await res.arrayBuffer();
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

  const onVolume = useCallback((v: number) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🎵 MIDI Ani Player</span>
        <span className="ver">v{version || "…"} · walking skeleton</span>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="cols">
        {/* Left: folder browser */}
        <section className="panel browser">
          <h3>NAS 폴더</h3>
          <div className="roots">
            {roots.map((r) => (
              <button key={r.path} onClick={() => navigate(r.path)}>
                📁 {r.name}
              </button>
            ))}
          </div>
          {listing && (
            <>
              <div className="crumb" title={listing.path}>
                {listing.path}
              </div>
              <ul className="entries">
                {listing.parent && (
                  <li>
                    <button onClick={() => navigate(listing.parent!)}>⬆ ..</button>
                  </li>
                )}
                {listing.entries.map((e) =>
                  e.type === "dir" ? (
                    <li key={e.path}>
                      <button onClick={() => navigate(e.path)}>📁 {e.name}</button>
                    </li>
                  ) : (
                    <li key={e.path}>
                      <button onClick={() => playPath(e.name, e.path)}>🎼 {e.name}</button>
                    </li>
                  ),
                )}
              </ul>
              <button className="scan" onClick={scan} disabled={busy}>
                {busy ? "…" : "🔎 이 폴더 스캔"}
              </button>
            </>
          )}
        </section>

        {/* Right: scanned library */}
        <section className="panel library">
          <h3>라이브러리 {songs.length ? `(${songs.length})` : ""}</h3>
          <ul className="songs">
            {songs.map((s) => (
              <li
                key={s.path}
                className={now?.path === s.path ? "active" : ""}
                onClick={() => playPath(s.title, s.path)}
              >
                <span className="t">{s.title}</span>
                <span className="f">{s.folder}</span>
              </li>
            ))}
            {!songs.length && <li className="hint">폴더를 스캔하면 곡이 여기 나타납니다.</li>}
          </ul>
        </section>
      </div>

      {/* Transport */}
      <footer className="transport">
        <button className="play" onClick={togglePlay} disabled={!now}>
          {paused ? "▶" : "⏸"}
        </button>
        <div className="np">
          <div className="title">{now?.title ?? "재생 중인 곡 없음"}</div>
          <div className="bar">
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
            onChange={(e) => onVolume(Number(e.target.value))}
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
