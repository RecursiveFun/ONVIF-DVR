import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev only — use `npm run lan` for other devices on your network.
    host: 'localhost',
    port,
    strictPort: true,
    hmr: process.env.VITE_HMR === 'true' ? { overlay: false } : false,
    ws: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/live': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port,
  },
});
