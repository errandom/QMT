
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // React 19 support with SWC for fast builds

export default defineConfig({
  plugins: [react()],
  root: '.',                 // Vite looks for index  root: '.',                 // Vite looks for index.html at the repo root
  base: '/',                 // Ensure absolute asset paths
  build: {
    outDir: 'dist/client',   // Where compiled assets go
    emptyOutDir: true,
    sourcemap: false,
    manifest: true
  },
  server: {
    port: 5173,
    open: true
  })
