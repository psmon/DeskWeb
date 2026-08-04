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
};
