import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Root points to your client source folder
  root: path.resolve(__dirname, 'client'),

  build: {
    // Output built assets to dist/client for clarity
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    sourcemap: false, // Disable source maps for production
    manifest: true,   // Generate manifest.json for server-side integration
    rollupOptions: {
      input: path.resolve(__dirname, 'client/index.html')
    }
  },

  server: {
    port: 5173, // Dev server port
    open: true
  }
});
