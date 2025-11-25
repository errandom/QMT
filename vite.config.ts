import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Root points to the directory containing index.html (your repo root)
  root: path.resolve(__dirname, '.'),

  build: {
    // Output built assets to dist/client for clarity
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    sourcemap: false, // Disable source maps for production
    manifest: true,   // Generate manifest.json for server-side integration
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html') // Correct entry point
    }
  },

  server: {
    port: 5173,
    open: true
  }
