import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      rollupOptions: {
        preserveEntrySignatures: "strict",
        input: resolve("src/main/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
          exports: "auto",
          footer: "if (typeof module.exports === 'function') module.exports.default = module.exports;",
        },
      },
    },
  },
  renderer: {
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        preserveEntrySignatures: "strict",
        // electron-vite treats renderer builds as applications unless an
        // explicit Rollup input is provided. Extensions have no index.html.
        input: resolve("src/renderer/index.tsx"),
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
          exports: "auto",
          footer: "if (typeof module.exports === 'function') module.exports.default = module.exports;",
        },
      },
    },
  },
});
