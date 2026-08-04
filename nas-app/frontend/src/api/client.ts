// REST client for the midi-ani-player backend.

export interface FsRoot {
  name: string;
  path: string;
}

export interface FsEntry {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number;
}

export interface FsListResponse {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}

export interface ScanEntry {
  title: string;
  path: string;
  folder: string;
  size: number;
}

export interface AppSettings {
  scanFolders: string[];
  defaultEngine: string;
  volume: number;
  lastSongPath: string | null;
  bitmidiEnabled: boolean;
}

export interface Health {
  status: string;
  version: string;
  roots: string[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<Health>("/api/health"),
  roots: () => getJson<FsRoot[]>("/api/fs/roots"),
  list: (path?: string) =>
    getJson<FsListResponse>(
      "/api/fs/list" + (path ? `?path=${encodeURIComponent(path)}` : ""),
    ),
  explore: (path?: string) =>
    getJson<FsListResponse>(
      "/api/fs/explore" + (path ? `?path=${encodeURIComponent(path)}` : ""),
    ),
  scan: (path: string) =>
    getJson<ScanEntry[]>(`/api/fs/scan?path=${encodeURIComponent(path)}`),
  settings: () => getJson<AppSettings>("/api/settings"),
  saveSettings: async (s: AppSettings): Promise<AppSettings> => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    if (!res.ok) throw new Error(`save settings → ${res.status}`);
    return (await res.json()) as AppSettings;
  },

  /** URL to stream a local NAS MIDI file (fed to the engine). */
  streamUrl: (path: string) => `/api/stream?path=${encodeURIComponent(path)}`,

  /** BitMidi online search (via backend proxy). Needs NAS internet access. */
  bitmidiSearch: async (q: string): Promise<BitmidiResult[]> => {
    const res = await fetch(`/api/bitmidi/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`bitmidi 검색 실패 (${res.status})`);
    const j = (await res.json()) as { result?: { results?: BitmidiRow[] } };
    const rows = j?.result?.results ?? [];
    return rows
      .filter((r) => r.downloadUrl)
      .map((r) => ({
        title: String(r.name ?? "").replace(/\.mid$/i, ""),
        url: new URL(r.downloadUrl!, "https://bitmidi.com").href,
      }));
  },

  /** URL to stream a BitMidi file through the backend proxy. */
  bitmidiFileUrl: (url: string) => `/api/bitmidi/file?url=${encodeURIComponent(url)}`,
};

interface BitmidiRow {
  name?: string;
  downloadUrl?: string;
}

export interface BitmidiResult {
  title: string;
  url: string;
}
