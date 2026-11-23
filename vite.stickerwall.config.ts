// Isolated offline-first build: no share middleware, photo gallery routes,
// analytics, events, or payment APIs are installed in this entrypoint.
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: {
    outDir: 'dist-stickerwall',
    emptyOutDir: true,
    rollupOptions: { input: 'stickerwall.html' },
  },
});
