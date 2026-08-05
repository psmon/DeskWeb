import { lazy, Suspense, useEffect, useMemo, useState, type RefObject } from "react";
import {
  api,
  BITMIDI_GENRES,
  type BitmidiCatalogEntry,
  type BitmidiResult,
  type FsListResponse,
  type FsRoot,
  type PlayItem,
  type ScanEntry,
} from "../api/client";
import { favorites } from "../state/favorites";

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
  onPlayQueue: (items: PlayItem[], index: number) => void;
  scoreOn: boolean;
  streamUrl: string | null;
  getTime: () => number;
  hidden?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function PlayerView(props: Props) {
  const { roots, listing, songs, nowPath, busy, bandCanvasRef } = props;
  const [source, setSource] = useState<"local" | "bitmidi" | "fav">("bitmidi");

  // liked songs (localStorage), reactive
  const [favList, setFavList] = useState<PlayItem[]>(() => favorites.list());
  useEffect(() => favorites.subscribe(() => setFavList(favorites.list())), []);
  const favSet = useMemo(() => new Set(favList.map((f) => f.id)), [favList]);

  // layout: collapsible sidebar + resizable panels
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [scoreWidth, setScoreWidth] = useState(380);

  // BitMidi state
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BitmidiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<BitmidiCatalogEntry[]>([]);
  const [genre, setGenre] = useState("전체");

  useEffect(() => {
    if (source === "bitmidi" && !catalog.length) {
      api.bitmidiCatalog().then(setCatalog).catch(() => {});
    }
  }, [source, catalog.length]);

  const browsing = !q.trim();
  const browseList = catalog.filter((e) => genre === "전체" || e.genre === genre);
  const bmShown = browsing ? browseList.slice(0, 600) : results;

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

  // drag-to-resize splitter. dir=+1 grows with rightward drag, -1 with leftward.
  const startDrag = (
    e: React.MouseEvent,
    get: () => number,
    set: (n: number) => void,
    dir: number,
    min: number,
    max: number,
  ) => {
    e.preventDefault();
    const x0 = e.clientX;
    const v0 = get();
    const onMove = (ev: MouseEvent) => set(clamp(v0 + (ev.clientX - x0) * dir, min, max));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };

  // build a queue from a local file listing / library / bitmidi list
  const localItems = (list: { title: string; path: string }[]): PlayItem[] =>
    list.map((x) => ({ title: x.title, id: x.path, kind: "local" }));
  const bmItems = (list: { title: string; url: string }[]): PlayItem[] =>
    list.map((x) => ({ title: x.title, id: x.url, kind: "bitmidi" }));

  // On mobile, selecting a track collapses the list so the band becomes the main
  // view (YouTube-Music style). Desktop keeps the list open.
  const selectPlay = (items: PlayItem[], index: number) => {
    props.onPlayQueue(items, index);
    if (window.matchMedia("(max-width: 700px)").matches) setSidebarOpen(false);
  };

  const heart = (item: PlayItem) => (
    <button
      className={"fav-btn" + (favSet.has(item.id) ? " on" : "")}
      title="좋아요"
      onClick={(e) => {
        e.stopPropagation();
        favorites.toggle(item);
      }}
    >
      {favSet.has(item.id) ? "❤" : "🤍"}
    </button>
  );

  return (
    <div className="playerview" hidden={props.hidden}>
      <aside
        className={"sidecol" + (sidebarOpen ? " open" : "")}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        <button className="sidecol-close" onClick={() => setSidebarOpen(false)}>
          연주 보기 ▶
        </button>
        <div className="source-switch">
          <button className={source === "bitmidi" ? "on" : ""} onClick={() => setSource("bitmidi")}>
            🎧 BitMidi
          </button>
          <button className={source === "local" ? "on" : ""} onClick={() => setSource("local")}>
            내 MIDI
          </button>
          <button className={source === "fav" ? "on" : ""} onClick={() => setSource("fav")}>
            ❤️ {favList.length || ""}
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
                          <button
                            onClick={() => {
                              const files = listing.entries.filter((x) => x.type === "file");
                              selectPlay(
                                localItems(files.map((f) => ({ title: f.name, path: f.path }))),
                                files.findIndex((f) => f.path === e.path),
                              );
                            }}
                          >
                            🎼 {e.name}
                          </button>
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
                {songs.map((s, i) => (
                  <li
                    key={s.path}
                    className={nowPath === s.path ? "active" : ""}
                    onClick={() => selectPlay(localItems(songs), i)}
                  >
                    {heart({ title: s.title, id: s.path, kind: "local" })}
                    <span className="t">{s.title}</span>
                    <span className="f">{s.folder}</span>
                  </li>
                ))}
                {!songs.length && <li className="hint">폴더를 스캔하면 곡이 여기 나타납니다.</li>}
              </ul>
            </section>
          </>
        ) : source === "bitmidi" ? (
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
                  <button key={g} className={genre === g ? "on" : ""} onClick={() => setGenre(g)}>
                    {g}
                  </button>
                ))}
              </div>
            )}
            {searchErr && <div className="error">{searchErr}</div>}
            <ul className="songs">
              {bmShown.map((e, i) => (
                <li
                  key={e.url}
                  className={nowPath === e.url ? "active" : ""}
                  onClick={() => selectPlay(bmItems(bmShown), i)}
                >
                  {heart({ title: e.title, id: e.url, kind: "bitmidi" })}
                  <span className="t">{e.title}</span>
                  {"genre" in e && <span className="f">{(e as BitmidiCatalogEntry).genre}</span>}
                </li>
              ))}
              {browsing && !catalog.length && <li className="hint">카탈로그 로딩…</li>}
              {!browsing && !results.length && !searching && (
                <li className="hint">검색 결과 없음 (인터넷 필요).</li>
              )}
            </ul>
          </section>
        ) : (
          <section className="bitmidi">
            <h3>❤️ 좋아요 {favList.length ? `(${favList.length})` : ""}</h3>
            <ul className="songs">
              {favList.map((f, i) => (
                <li
                  key={f.id}
                  className={nowPath === f.id ? "active" : ""}
                  onClick={() => selectPlay(favList, i)}
                >
                  {heart(f)}
                  <span className="t">{f.title}</span>
                  <span className="f">{f.kind === "bitmidi" ? "BitMidi" : "내 MIDI"}</span>
                </li>
              ))}
              {!favList.length && (
                <li className="hint">곡 옆의 하트를 누르면 여기에 모입니다.</li>
              )}
            </ul>
          </section>
        )}
      </aside>

      {sidebarOpen && (
        <div
          className="splitter v"
          onMouseDown={(e) => startDrag(e, () => sidebarWidth, setSidebarWidth, 1, 200, 560)}
        />
      )}

      <div className="stage">
        <button
          className="side-toggle"
          title="목록 접기/펼치기"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          {sidebarOpen ? "◀" : "☰ 목록"}
        </button>
        <canvas ref={bandCanvasRef} className="band-canvas" />
        {props.scoreOn && (
          <>
            <div
              className="splitter v"
              onMouseDown={(e) => startDrag(e, () => scoreWidth, setScoreWidth, -1, 240, 720)}
            />
            <div className="score-wrap" style={{ width: scoreWidth }}>
              <Suspense fallback={<div className="score-panel">악보 로딩…</div>}>
                <ScoreView visible={true} streamUrl={props.streamUrl} getTime={props.getTime} />
              </Suspense>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
