import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev`, the Vite dev server proxies /api requests to the
// Express server (default http://localhost:3000) so the browser only ever
// talks to one origin — same as production, where Express serves the built
// client directly.
const backendPort = process.env.PORT || 3000;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
