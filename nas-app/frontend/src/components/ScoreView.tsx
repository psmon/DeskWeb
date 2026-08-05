import { useEffect, useRef, useState } from "react";
import "html-midi-player"; // registers <midi-visualizer>
import { urlToNoteSequence } from "@magenta/music/esm/core/midi_io.js";
import { PianoKeys } from "../engines/pianoKeys";
import { noteBus } from "../state/noteBus";

// Score view (악보보기), multi-row. The song is parsed once (no render), then only
// a small window of consecutive PAGE_SEC-second pages is rendered as stacked rows
// that fill the panel (~VISIBLE_ROWS lines). As playback advances the stack scrolls
// vertically (past line leaves the top, next line enters the bottom) — natural,
// and cheap because only a handful of pages are ever rendered at once.

const PAGE_SEC = 6; // seconds of music per line
const VISIBLE_ROWS = 4; // lines filling the panel
const PAST_ROWS = 1; // played lines kept above the current one
const BUFFER = 1; // extra rendered rows beyond the visible window

interface Note {
  startTime?: number;
  endTime?: number;
}
interface NoteSeq {
  notes: Note[];
  totalTime?: number;
  tempos?: unknown;
  timeSignatures?: unknown;
  ticksPerQuarter?: number;
  quantizationInfo?: unknown;
}
type Vis = HTMLElement & { noteSequence?: NoteSeq; redraw?: (n: Note) => void };
interface Row {
  el: HTMLDivElement;
  vis: Vis;
  notes: Note[];
}

interface Props {
  streamUrl: string | null;
  getTime: () => number;
  visible: boolean;
}

export default function ScoreView({ streamUrl, getTime, visible }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const pianoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullRef = useRef<NoteSeq | null>(null);
  const rowsRef = useRef<Map<number, Row>>(new Map());
  const loadSeq = useRef(0);
  const [type, setType] = useState<"staff" | "piano-roll">("staff");
  const [status, setStatus] = useState("");

  const clearRows = () => {
    rowsRef.current.forEach((r) => r.el.remove());
    rowsRef.current.clear();
  };

  // parse (no render) on song change
  useEffect(() => {
    fullRef.current = null;
    clearRows();
    if (!streamUrl) return;
    const token = ++loadSeq.current;
    setStatus("악보 로딩…");
    urlToNoteSequence(streamUrl)
      .then((ns) => {
        if (token !== loadSeq.current) return;
        fullRef.current = ns as unknown as NoteSeq;
        setStatus("");
      })
      .catch((e: unknown) => {
        if (token === loadSeq.current) setStatus("악보 파싱 실패");
        console.error("[score] parse failed", e);
      });
  }, [streamUrl]);

  // notation type change → re-render rows
  useEffect(() => {
    clearRows();
  }, [type]);

  // piano-roll mode: a live, vertical piano keyboard struck by note events.
  useEffect(() => {
    if (type !== "piano-roll") return;
    const canvas = pianoCanvasRef.current;
    if (!canvas) return;
    const pk = new PianoKeys(canvas);
    pk.start();
    const unsub = noteBus.subscribe((e) => pk.onNote(e));
    return () => {
      unsub();
      pk.dispose();
    };
  }, [type]);

  useEffect(() => {
    let raf = 0;

    const pageSub = (idx: number, ns: NoteSeq) => {
      const a = idx * PAGE_SEC;
      const c = (idx + 1) * PAGE_SEC;
      const notes = ns.notes.filter((n) => (n.startTime || 0) < c && (n.endTime || 0) > a);
      const sub: NoteSeq = {
        notes,
        tempos: ns.tempos,
        timeSignatures: ns.timeSignatures,
        totalTime: ns.totalTime,
        ticksPerQuarter: ns.ticksPerQuarter,
        quantizationInfo: ns.quantizationInfo,
      };
      return { sub, notes };
    };

    const ensureRow = (P: number, ns: NoteSeq, rowH: number): Row | undefined => {
      if (P < 0 || !stackRef.current) return;
      let row = rowsRef.current.get(P);
      if (!row) {
        const el = document.createElement("div");
        el.className = "score-row";
        const vis = document.createElement("midi-visualizer") as Vis;
        vis.setAttribute("type", type);
        vis.className = "score-vis";
        el.appendChild(vis);
        stackRef.current.appendChild(el);
        const { sub, notes } = pageSub(P, ns);
        try {
          vis.noteSequence = sub;
        } catch {
          /* ignore */
        }
        row = { el, vis, notes: notes.slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0)) };
        rowsRef.current.set(P, row);
      }
      row.el.style.top = P * rowH + "px";
      row.el.style.height = rowH + "px";
      return row;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const full = fullRef.current;
      const body = bodyRef.current;
      const stack = stackRef.current;
      if (!full || !body || !stack) return;

      const rowH = Math.max(80, Math.floor(body.clientHeight / VISIBLE_ROWS));
      const t = getTime();
      const cur = Math.max(0, Math.floor(t / PAGE_SEC));
      const totalPages = Math.max(1, Math.ceil((full.totalTime || 0) / PAGE_SEC));

      const from = Math.max(0, cur - PAST_ROWS - BUFFER);
      const to = Math.min(totalPages - 1, cur + (VISIBLE_ROWS - PAST_ROWS) + BUFFER);
      for (let P = from; P <= to; P++) ensureRow(P, full, rowH);
      // drop rows outside the window
      rowsRef.current.forEach((row, P) => {
        if (P < from - 1 || P > to + 1) {
          row.el.remove();
          rowsRef.current.delete(P);
        }
        row.el.classList.toggle("current", P === cur);
      });

      // scroll so the current line sits PAST_ROWS down from the top
      const scrollTop = Math.max(0, cur - PAST_ROWS) * rowH;
      stack.style.transform = `translateY(${-scrollTop}px)`;

      // highlight the active note on the current line
      const row = rowsRef.current.get(cur);
      if (row?.vis.redraw && row.notes.length) {
        let active: Note | null = null;
        for (let i = 0; i < row.notes.length; i++) {
          if ((row.notes[i].startTime || 0) <= t) active = row.notes[i];
          else break;
        }
        if (active) {
          try {
            row.vis.redraw(active);
          } catch {
            /* transient */
          }
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTime, type]);

  return (
    <div className="score-panel" hidden={!visible}>
      <div className="score-head">
        <span>악보보기 {status && <em className="score-status">· {status}</em>}</span>
        <select value={type} onChange={(e) => setType(e.target.value as "staff" | "piano-roll")}>
          <option value="staff">오선보</option>
          <option value="piano-roll">피아노</option>
        </select>
      </div>
      <div className="score-body" ref={bodyRef}>
        {type === "piano-roll" ? (
          <canvas ref={pianoCanvasRef} className="piano-canvas" />
        ) : (
          <div className="score-stack" ref={stackRef} />
        )}
      </div>
    </div>
  );
}
