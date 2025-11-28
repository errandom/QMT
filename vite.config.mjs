
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  resolve: {
      alias: {
        '@github/spark': '@github/spark/dist/index.js'
      }
    },
  root: '.',
  base: '/',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    sourcemap: false,
    manifest: true
  },
  server: {
    port: 5173,
    open: true
  }
});
