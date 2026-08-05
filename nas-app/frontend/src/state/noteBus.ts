// Tiny pub/sub so live MIDI note events (from the playback engine) can drive
// multiple visualizers (band, piano keyboard) without prop-drilling.

export interface NoteEvent {
  channel: number;
  program: number;
  midiNote: number;
  velocity: number;
}

type Listener = (e: NoteEvent) => void;
const listeners = new Set<Listener>();

export const noteBus = {
  emit(e: NoteEvent) {
    listeners.forEach((l) => {
      try {
        l(e);
      } catch {
        /* ignore listener errors */
      }
    });
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
