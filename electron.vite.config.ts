import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: resolve("src/main/index.ts"),
        output: { format: "cjs", entryFileNames: "index.cjs", exports: "auto" },
      },
    },
  },
  renderer: {
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        // electron-vite treats renderer builds as applications unless an
        // explicit Rollup input is provided. Extensions have no index.html.
        input: resolve("src/renderer/index.tsx"),
        output: { format: "cjs", entryFileNames: "index.cjs", exports: "auto" },
      },
    },
  },
});
