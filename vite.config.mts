// vite.config.mts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from "path";

// PROJECT_ROOT for alias resolution (ESM-friendly)
const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),            // SWC-based React plugin (good choice for speed)
    tailwindcss(),
    createIconImportProxy(), // Spark Phosphor proxy
    sparkPlugin(),           // Spark Vite plugin
  ],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },
  build: {
    outDir: "dist",
    // (Optional) If bundle stays large, add manualChunks or split vendor:
