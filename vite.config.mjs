import { defineConfig } from 'vite';

// IMPORTANT: index.html is at the repo root
export default defineConfig({
  root: '.',                 // Vite looks for index.html here
  build: {
    outDir: 'dist/client',   // where compiled assets go
    emptyOutDir: true,
    sourcemap: false,
    manifest: true
  },
  server: {
    port: 5173,
    open: true
  }
});
