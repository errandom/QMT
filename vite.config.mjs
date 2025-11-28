// vite.config.mjs
import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc'; // works fine with React 18+ too

export default defineConfig({
  plugins: [react()],
  root: '.',                 // index.html at repo root
  base: '/',                 // absolute asset paths
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src')  // map "@/..." -> "<repo>/src"
    }
  },
  build: {
    out    outDir: 'dist',          // NOTE: your build emits to 'dist' (index.html + assets)
    emptyOutDir: true,
    sourcemap: false,
    manifest: true
  },
  server: {
    port: 5173,
    open: true
  }
