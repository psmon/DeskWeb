import type { RefObject } from "react";
import type { FsListResponse, FsRoot, ScanEntry } from "../api/client";

interface Props {
  roots: FsRoot[];
  listing: FsListResponse | null;
  songs: ScanEntry[];
  nowPath: string | null;
  busy: boolean;
  bandCanvasRef: RefObject<HTMLCanvasElement | null>;
  onNavigate: (path: string) => void;
  onScan: () => void;
  onPlay: (title: string, path: string) => void;
  hidden?: boolean;
}

export default function PlayerView(props: Props) {
  const { roots, listing, songs, nowPath, busy, bandCanvasRef } = props;

  return (
    <div className="playerview" hidden={props.hidden}>
      {/* left column: browser + library */}
      <aside className="sidecol">
        <section className="panel browser">
          <h3>NAS 폴더</h3>
          <div className="roots">
            {roots.map((r) => (
              <button key={r.path} onClick={() => props.onNavigate(r.path)}>
                📁 {r.name}
              </button>
            ))}
            {!roots.length && <span className="hint">설정에서 폴더를 추가하세요.</span>}
          </div>
          {listing && (
            <>
              <div className="crumb" title={listing.path}>
                {listing.path}
              </div>
              <ul className="entries">
                {listing.parent && (
                  <li>
                    <button onClick={() => props.onNavigate(listing.parent!)}>⬆ ..</button>
                  </li>
                )}
                {listing.entries.map((e) =>
                  e.type === "dir" ? (
                    <li key={e.path}>
                      <button onClick={() => props.onNavigate(e.path)}>📁 {e.name}</button>
                    </li>
                  ) : (
                    <li key={e.path}>
                      <button onClick={() => props.onPlay(e.name, e.path)}>🎼 {e.name}</button>
                    </li>
                  ),
                )}
              </ul>
              <button className="scan" onClick={props.onScan} disabled={busy}>
                {busy ? "…" : "🔎 이 폴더 스캔"}
              </button>
            </>
          )}
        </section>

        <section className="panel library">
          <h3>라이브러리 {songs.length ? `(${songs.length})` : ""}</h3>
          <ul className="songs">
            {songs.map((s) => (
              <li
                key={s.path}
                className={nowPath === s.path ? "active" : ""}
                onClick={() => props.onPlay(s.title, s.path)}
              >
                <span className="t">{s.title}</span>
                <span className="f">{s.folder}</span>
              </li>
            ))}
            {!songs.length && <li className="hint">폴더를 스캔하면 곡이 여기 나타납니다.</li>}
          </ul>
        </section>
      </aside>

      {/* center: band stage */}
      <div className="stage">
        <canvas ref={bandCanvasRef} className="band-canvas" />
      </div>
    </div>
  );
}
