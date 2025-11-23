// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vite will look for an index.html at the `root` path.
 * We set the root to /client and build into /client/dist.
 * Your package.json "copy-client" script moves built assets into /dist.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: 'dist',       // → /client/dist
    emptyOutDir: true
  }
});
