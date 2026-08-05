import type { PlayItem } from "../api/client";

// Liked songs, persisted in localStorage (per device). Newest first.
const KEY = "midi.favorites.v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): PlayItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(list: PlayItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full/blocked — ignore */
  }
  listeners.forEach((l) => l());
}

export const favorites = {
  list: read,
  has(id: string): boolean {
    return read().some((f) => f.id === id);
  },
  /** Toggle; returns true if now favorited. */
  toggle(item: PlayItem): boolean {
    const list = read();
    const i = list.findIndex((f) => f.id === item.id);
    if (i >= 0) {
      list.splice(i, 1);
      write(list);
      return false;
    }
    list.unshift(item);
    write(list);
    return true;
  },
  remove(id: string) {
    write(read().filter((f) => f.id !== id));
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
