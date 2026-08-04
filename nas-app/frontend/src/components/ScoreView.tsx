import { useEffect, useRef, useState } from "react";
import "html-midi-player"; // registers <midi-player> / <midi-visualizer> custom elements

// Score view (악보보기). Loads the current song's MIDI into an html-midi-player
// <midi-visualizer> (client-side parse, no soundfont → works offline) and moves
// the highlight cursor by reading the playback engine's clock each frame.

interface Note {
  startTime: number;
}

interface Props {
  streamUrl: string | null;
  getTime: () => number;
  visible: boolean;
}

export default function ScoreView({ streamUrl, getTime, visible }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The custom element and its parsed notes are loosely typed.
  const visRef = useRef<HTMLElement & { src?: string; noteSequence?: { notes: Note[] }; redraw?: (n: Note) => void }>(
    null as never,
  );
  const notesRef = useRef<Note[]>([]);
  const [type, setType] = useState<"staff" | "piano-roll">("staff");

  // create the visualizer element once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const vis = document.createElement("midi-visualizer") as HTMLElement & {
      src?: string;
      noteSequence?: { notes: Note[] };
      redraw?: (n: Note) => void;
    };
    vis.setAttribute("type", type);
    vis.className = "score-vis";
    host.appendChild(vis);
    visRef.current = vis;
    return () => {
      host.removeChild(vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reflect the notation type
  useEffect(() => {
    visRef.current?.setAttribute("type", type);
  }, [type]);

  // load a new song
  useEffect(() => {
    const vis = visRef.current;
    if (!vis) return;
    notesRef.current = [];
    if (streamUrl) vis.src = streamUrl;
  }, [streamUrl]);

  // cursor tick — highlight the note under the playhead
  useEffect(() => {
    let raf = 0;
    let lastActive: Note | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vis = visRef.current;
      if (!vis) return;
      // lazily pick up the parsed sequence once the src has loaded
      if (!notesRef.current.length && vis.noteSequence?.notes?.length) {
        notesRef.current = [...vis.noteSequence.notes].sort((a, b) => a.startTime - b.startTime);
      }
      const notes = notesRef.current;
      if (!notes.length || !vis.redraw) return;
      const t = getTime();
      let active: Note | null = null;
      for (let i = 0; i < notes.length; i++) {
        if (notes[i].startTime <= t) active = notes[i];
        else break;
      }
      // only redraw when the active note changes; guard against the library's
      // occasional getComputedStyle-on-null during scrollIntoView.
      if (active && active !== lastActive) {
        lastActive = active;
        try {
          vis.redraw(active);
        } catch {
          /* transient layout race — ignore */
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getTime]);

  return (
    <div className="score-panel" hidden={!visible}>
      <div className="score-head">
        <span>악보보기</span>
        <select value={type} onChange={(e) => setType(e.target.value as "staff" | "piano-roll")}>
          <option value="staff">오선보</option>
          <option value="piano-roll">피아노롤</option>
        </select>
      </div>
      <div className="score-body" ref={hostRef} />
    </div>
  );
}
