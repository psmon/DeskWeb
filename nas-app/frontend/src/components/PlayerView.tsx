import { lazy, Suspense, useEffect, useState, type RefObject } from "react";
import {
  api,
  BITMIDI_GENRES,
  type BitmidiCatalogEntry,
  type BitmidiResult,
  type FsListResponse,
  type FsRoot,
  type ScanEntry,
} from "../api/client";

// html-midi-player bundles magenta+tone (~2MB) — load it only when the score
// view is actually opened, keeping the initial bundle small.
const ScoreView = lazy(() => import("./ScoreView"));

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
  onPlayBitmidi: (title: string, url: string) => void;
  scoreOn: boolean;
  streamUrl: string | null;
  getTime: () => number;
  hidden?: boolean;
}

export default function PlayerView(props: Props) {
  const { roots, listing, songs, nowPath, busy, bandCanvasRef } = props;
  const [source, setSource] = useState<"local" | "bitmidi">("local");

  // BitMidi search state (self-contained)
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BitmidiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<BitmidiCatalogEntry[]>([]);
  const [genre, setGenre] = useState("전체");

  // Load the bundled catalog the first time the BitMidi tab is opened.
  useEffect(() => {
    if (source === "bitmidi" && !catalog.length) {
      api.bitmidiCatalog().then(setCatalog).catch(() => {});
    }
  }, [source, catalog.length]);

  const browsing = !q.trim();
  const browseList = catalog.filter((e) => genre === "전체" || e.genre === genre);

  const doSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    setSearchErr(null);
    try {
      setResults(await api.bitmidiSearch(q));
    } catch (e) {
      setSearchErr(String(e));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="playerview" hidden={props.hidden}>
      <aside className="sidecol">
        <div className="source-switch">
          <button className={source === "local" ? "on" : ""} onClick={() => setSource("local")}>
            내 라이브러리
          </button>
          <button className={source === "bitmidi" ? "on" : ""} onClick={() => setSource("bitmidi")}>
            BitMidi
          </button>
        </div>

        {source === "local" ? (
          <>
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
          </>
        ) : (
          <section className="bitmidi">
            <h3>BitMidi 온라인 {browsing ? `간편재생 (${catalog.length})` : "검색"}</h3>
            <div className="search">
              <input
                value={q}
                placeholder="곡 제목 검색… (전체 라이브러리)"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
              />
              <button onClick={doSearch} disabled={searching}>
                {searching ? "…" : "🔎"}
              </button>
            </div>
            {browsing && (
              <div className="bm-genres">
                {BITMIDI_GENRES.map((g) => (
                  <button
                    key={g}
                    className={genre === g ? "on" : ""}
                    onClick={() => setGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
            {searchErr && <div className="error">{searchErr}</div>}
            <ul className="songs">
              {browsing
                ? browseList.slice(0, 600).map((e) => (
                    <li
                      key={e.url}
                      className={nowPath === e.url ? "active" : ""}
                      onClick={() => props.onPlayBitmidi(e.title, e.url)}
                    >
                      <span className="t">{e.title}</span>
                      <span className="f">{e.genre}</span>
                    </li>
                  ))
                : results.map((r) => (
                    <li
                      key={r.url}
                      className={nowPath === r.url ? "active" : ""}
                      onClick={() => props.onPlayBitmidi(r.title, r.url)}
                    >
                      <span className="t">{r.title}</span>
                    </li>
                  ))}
              {browsing && !catalog.length && <li className="hint">카탈로그 로딩…</li>}
              {!browsing && !results.length && !searching && (
                <li className="hint">검색 결과 없음 (인터넷 필요).</li>
              )}
            </ul>
          </section>
        )}
      </aside>

      <div className="stage">
        <canvas ref={bandCanvasRef} className="band-canvas" />
        {props.scoreOn && (
          <Suspense fallback={<div className="score-panel">악보 로딩…</div>}>
            <ScoreView visible={true} streamUrl={props.streamUrl} getTime={props.getTime} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
