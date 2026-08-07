import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  api,
  BITMIDI_GENRES,
  trackToPlayItem,
  type BitmidiResult,
  type FsListResponse,
  type FsRoot,
  type PlayItem,
  type ScanEntry,
  type TrackDto,
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
const PAGE_SIZE = 50;   // fetch 50 at a time (infinite scroll)
const ROW_H = 40;       // fixed row height → virtualized rendering
const OVERSCAN = 6;     // rows rendered above/below the viewport
type Source = "bitmidi" | "local" | "fav";

export default function PlayerView(props: Props) {
  const { roots, listing, songs, nowPath, busy, bandCanvasRef } = props;
  const [source, setSource] = useState<Source>("bitmidi");

  // liked songs (localStorage), reactive
  const [favList, setFavList] = useState<PlayItem[]>(() => favorites.list());
  useEffect(() => favorites.subscribe(() => setFavList(favorites.list())), []);
  const favSet = useMemo(() => new Set(favList.map((f) => f.id)), [favList]);

  // layout: collapsible sidebar + resizable panels
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [scoreWidth, setScoreWidth] = useState(380);

  // ---- DB-backed playlist (bitmidi + local), paged + FTS search -------------
  const [genre, setGenre] = useState("전체");
  const [queryInput, setQueryInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [items, setItems] = useState<TrackDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // guards against out-of-order responses when filters change fast
  const reqSeq = useRef(0);
  const loadingRef = useRef(false); // synchronous guard so scroll can't stack loads

  // virtualized scroll: only rows in view are in the DOM, so a 100k-row catalog
  // renders the same handful of nodes as a 50-row one.
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(500);

  // online bitmidi.com live search (finds songs not yet secured in the DB)
  const [online, setOnline] = useState<BitmidiResult[] | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  const dbSource = source === "local" ? "local" : "bitmidi";

  const load = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current && !reset) return; // don't stack infinite-scroll loads
      loadingRef.current = true;
      const nextPage = reset ? 0 : page + 1;
      const seq = ++reqSeq.current;
      setLoading(true);
      setLoadErr(null);
      try {
        const res = await api.tracks({
          source: dbSource,
          genre: dbSource === "bitmidi" ? genre : undefined,
          q: appliedQuery || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        if (seq !== reqSeq.current) return; // superseded
        setTotal(res.total);
        setPage(res.page);
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (seq === reqSeq.current) setLoadErr(String(e));
      } finally {
        if (seq === reqSeq.current) setLoading(false);
        loadingRef.current = false;
      }
    },
    [dbSource, genre, appliedQuery, page],
  );

  // Reset + reload whenever the filter set changes. `songs` is bumped by App on
  // each local scan → reloads the local list from the DB after new files land.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (source === "fav") return;
    setOnline(null);
    setScrollTop(0);
    if (listRef.current) listRef.current.scrollTop = 0;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSource, genre, appliedQuery, songs]);

  // Track the scroll viewport height so the virtual window sizes correctly.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight || 500);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [source]);

  const runSearch = () => setAppliedQuery(queryInput.trim());
  const clearSearch = () => {
    setQueryInput("");
    setAppliedQuery("");
  };

  const searchOnline = async () => {
    const q = queryInput.trim();
    if (!q) return;
    setOnlineLoading(true);
    try {
      setOnline(await api.bitmidiSearch(q));
    } catch {
      setOnline([]);
    } finally {
      setOnlineLoading(false);
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

  // On mobile, selecting a track collapses the list so the band becomes the main
  // view (YouTube-Music style). Desktop keeps the list open.
  const selectPlay = (queue: PlayItem[], index: number) => {
    props.onPlayQueue(queue, index);
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

  // Virtualized, infinite-scrolling DB-track list. Only the rows within the
  // viewport (± overscan) are in the DOM, and the next 50 load automatically as
  // you near the bottom — so the page stays fast whether the catalog is 50 or
  // 100k songs. The queue passed to the player is the whole loaded set.
  const trackList = () => {
    const queue = items.map(trackToPlayItem);
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
    const end = Math.min(items.length, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN);
    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      setScrollTop(el.scrollTop);
      // near the bottom of what's loaded, and more exists → pull the next page
      if (items.length < total && el.scrollTop + el.clientHeight > (items.length - 8) * ROW_H) {
        load(false);
      }
    };
    return (
      <div className="songs vsongs" ref={listRef} onScroll={onScroll}>
        {!items.length && !loading && (
          <div className="hint">
            {appliedQuery
              ? "검색 결과 없음."
              : source === "local"
                ? "폴더를 스캔하면 곡이 여기 나타납니다."
                : "카탈로그 없음."}
          </div>
        )}
        <div className="vspacer" style={{ height: items.length * ROW_H }}>
          {items.slice(start, end).map((t, i) => {
            const idx = start + i;
            const item = trackToPlayItem(t);
            return (
              <div
                key={`${t.source}:${t.id}`}
                className={"row" + (nowPath === t.ref ? " active" : "")}
                style={{ top: idx * ROW_H, height: ROW_H }}
                onClick={() => selectPlay(queue, idx)}
              >
                {heart(item)}
                <span className="t">{t.title}</span>
                <span className="f">{t.genre ?? t.folder ?? ""}</span>
              </div>
            );
          })}
        </div>
        {loading && (
          <div className="vloading">불러오는 중… {total ? `(${items.length}/${total})` : ""}</div>
        )}
      </div>
    );
  };

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

        {source === "fav" ? (
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
              {!favList.length && <li className="hint">곡 옆의 하트를 누르면 여기에 모입니다.</li>}
            </ul>
          </section>
        ) : (
          <section className="bitmidi">
            <h3>
              {source === "bitmidi" ? "🎧 BitMidi" : "📂 내 라이브러리"}{" "}
              <span className="count">{appliedQuery ? `검색 ${total}` : total}</span>
            </h3>

            {source === "local" && (
              <div className="panel browser">
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
                                  files.map((f) => ({ title: f.name, id: f.path, kind: "local" })),
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
                      {busy ? "…" : "🔎 이 폴더 스캔 → DB"}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="search">
              <input
                value={queryInput}
                placeholder={source === "bitmidi" ? "제목 검색 (내장 DB 전체)" : "내 곡 제목 검색"}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
              />
              <button onClick={runSearch} disabled={loading}>
                🔎
              </button>
              {appliedQuery && (
                <button className="clear" title="검색 지우기" onClick={clearSearch}>
                  ✕
                </button>
              )}
            </div>

            {source === "bitmidi" && !appliedQuery && (
              <div className="bm-genres">
                {BITMIDI_GENRES.map((g) => (
                  <button key={g} className={genre === g ? "on" : ""} onClick={() => setGenre(g)}>
                    {g}
                  </button>
                ))}
              </div>
            )}

            {loadErr && <div className="error">{loadErr}</div>}

            {trackList()}

            {source === "bitmidi" && queryInput.trim() && (
              <div className="online">
                <button className="online-btn" onClick={searchOnline} disabled={onlineLoading}>
                  {onlineLoading ? "온라인 검색 중…" : "🌐 온라인(bitmidi.com)에서 더 찾기"}
                </button>
                {online && (
                  <ul className="songs">
                    {online.map((r, i) => (
                      <li
                        key={r.url}
                        className={nowPath === r.url ? "active" : ""}
                        onClick={() =>
                          selectPlay(
                            online.map((x) => ({ title: x.title, id: x.url, kind: "bitmidi" as const })),
                            i,
                          )
                        }
                      >
                        {heart({ title: r.title, id: r.url, kind: "bitmidi" })}
                        <span className="t">{r.title}</span>
                        <span className="f">🌐 온라인</span>
                      </li>
                    ))}
                    {!online.length && <li className="hint">온라인 결과 없음 (인터넷 필요).</li>}
                  </ul>
                )}
              </div>
            )}
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
