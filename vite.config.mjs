import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src')
    }
  },
  build: {
    outDir: 'dist',          // ✅ Corrected
    emptyOutDir: true,
    sourcemap: false,
    manifest: true
  },
  server: {
    port: 5173,
    open: true
  }
});
