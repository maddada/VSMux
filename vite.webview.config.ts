import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "copy-ghostty-wasm",
      async writeBundle() {
        const sourcePath = resolve(__dirname, "forks", "ghostty-web", "ghostty-vt.wasm");
        const targetPath = resolve(__dirname, "dist", "webview", "assets", "ghostty-vt.wasm");
        await copyFile(sourcePath, targetPath);
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist/webview",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
