import { useEffect, useRef, useState } from "react";
import "html-midi-player"; // registers <midi-visualizer>
// Parse-only (no render) MIDI → NoteSequence. Lets us render just a time window.
import { urlToNoteSequence } from "@magenta/music/esm/core/midi_io.js";

// Score view (악보보기). Optimized like DeskWeb MidiPlayerWindow: parse the whole
// song once WITHOUT rendering, then render only the current PAGE_SEC-second window
// into the visualizer — so large songs stay light instead of rendering every note.

const PAGE_SEC = 8;

interface Note {
  startTime?: number;
  endTime?: number;
}
interface NoteSeq {
  notes: Note[];
  tempos?: unknown;
  timeSignatures?: unknown;
  totalTime?: number;
  ticksPerQuarter?: number;
  quantizationInfo?: unknown;
}
type Vis = HTMLElement & { noteSequence?: NoteSeq; redraw?: (n: Note) => void };

interface Props {
  streamUrl: string | null;
  getTime: () => number;
  visible: boolean;
}

export default function ScoreView({ streamUrl, getTime, visible }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const visRef = useRef<Vis>(null as never);
  const fullRef = useRef<NoteSeq | null>(null);
  const loadSeq = useRef(0);
  const [type, setType] = useState<"staff" | "piano-roll">("staff");
  const [status, setStatus] = useState<string>("");

  // create the visualizer element once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const vis = document.createElement("midi-visualizer") as Vis;
    vis.setAttribute("type", type);
    vis.className = "score-vis";
    host.appendChild(vis);
    visRef.current = vis;
    return () => {
      host.removeChild(vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    visRef.current?.setAttribute("type", type);
  }, [type]);

  // parse (no render) whenever the song changes
  useEffect(() => {
    fullRef.current = null;
    if (!streamUrl) return;
    const token = ++loadSeq.current;
    setStatus("악보 로딩…");
    urlToNoteSequence(streamUrl)
      .then((ns) => {
        if (token !== loadSeq.current) return; // a newer song started
        fullRef.current = ns as unknown as NoteSeq;
        setStatus("");
      })
      .catch((e: unknown) => {
        if (token === loadSeq.current) setStatus("악보 파싱 실패");
        console.error("[score] parse failed", e);
      });
  }, [streamUrl]);

  // tick: swap the rendered page as playback crosses PAGE_SEC boundaries,
  // and move the highlight cursor within the current page.
  useEffect(() => {
    let raf = 0;
    let topPage = -1;
    let loaded: NoteSeq | null = null;
    let pageNotes: Note[] = [];
    let cursor = 0;
    let force = false;

    const buildSub = (idx: number, ns: NoteSeq): NoteSeq => {
      const a = idx * PAGE_SEC;
      const c = (idx + 1) * PAGE_SEC;
      const notes = ns.notes.filter((n) => (n.startTime || 0) < c && (n.endTime || 0) > a);
      return {
        notes,
        tempos: ns.tempos,
        timeSignatures: ns.timeSignatures,
        totalTime: ns.totalTime,
        ticksPerQuarter: ns.ticksPerQuarter,
        quantizationInfo: ns.quantizationInfo,
      };
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vis = visRef.current;
      const full = fullRef.current;
      if (!vis || !full) return;
      if (full !== loaded) {
        loaded = full; // new song parsed → force rebuild from its page
        topPage = -1;
      }
      const t = getTime();
      const idx = Math.max(0, Math.floor(t / PAGE_SEC));
      if (idx !== topPage) {
        const sub = buildSub(idx, full);
        try {
          vis.noteSequence = sub;
        } catch {
          /* ignore */
        }
        pageNotes = sub.notes.slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
        cursor = 0;
        force = true;
        topPage = idx;
      }
      if (!pageNotes.length) return;
      let i = cursor;
      while (i + 1 < pageNotes.length && (pageNotes[i + 1].startTime || 0) <= t) i++;
      while (i > 0 && (pageNotes[i].startTime || 0) > t) i--;
      if (i !== cursor || force) {
        cursor = i;
        force = false;
        const n = pageNotes[i];
        if (n && (n.startTime || 0) <= t + 0.1) {
          try {
            vis.redraw?.(n);
          } catch {
            /* transient layout race */
          }
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTime]);

  return (
    <div className="score-panel" hidden={!visible}>
      <div className="score-head">
        <span>악보보기 {status && <em className="score-status">· {status}</em>}</span>
        <select value={type} onChange={(e) => setType(e.target.value as "staff" | "piano-roll")}>
          <option value="staff">오선보</option>
          <option value="piano-roll">피아노롤</option>
        </select>
      </div>
      <div className="score-body" ref={hostRef} />
    </div>
  );
}
