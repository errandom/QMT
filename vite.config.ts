// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

// Build the client from /client and emit into /client/dist.
// Your package.json script `copy-client` moves these assets into /dist/.
export defaultexport default defineConfig({
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
