import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

const extensionExternals = [
  "@freelensapp/extensions",
  "react",
  "react/jsx-runtime",
];

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: resolve("src/main/index.ts"),
        external: extensionExternals,
        output: { format: "es", entryFileNames: "index.js" },
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
        external: extensionExternals,
        output: { format: "es", entryFileNames: "index.js" },
      },
    },
  },
});
