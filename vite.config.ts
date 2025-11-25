import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: false,
    manifest: true,
  },
  server: {
    port: 5173,
    open: true,
  },
