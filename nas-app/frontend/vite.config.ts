import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Build output goes straight into the UPK rootfs so `blumn`/midi-ani-player can
// serve it. public/ assets (vendored soundfont, worklet, sprites) are copied in.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../packaging/rootfs_common/www", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    // Dev: proxy API calls to the running .NET backend (MIDI_PORT default 29090).
    proxy: {
      "/api": "http://localhost:29090",
    },
  },
});
