// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

// Build client from /client to /client/dist.
// Your package.json "copy-client" script moves these assets into /dist/.
export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
