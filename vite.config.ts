import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 300,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: { manualChunks: { ukrainian: ['./shared/uk.ts', './shared/uk-tasks.ts'] } },
    },
  },
  server: { host: '127.0.0.1' },
});
