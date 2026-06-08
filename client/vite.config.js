import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = 5173;

export default defineConfig({
  plugins: [react()],
  build: {
    // hls.js is a single ~520 kB vendor file; it is lazy-loaded via loadHls().
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
          if (id.includes('react-dom') || /[/\\]react[/\\]/.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
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
