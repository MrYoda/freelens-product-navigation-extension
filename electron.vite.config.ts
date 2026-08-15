import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { globalExternals } from "./build/global-externals.cjs";

const runtimeExternals = ["electron", /^electron\//, ...builtinModules, ...builtinModules.map(name => `node:${name}`)];
const output = { format: "cjs" as const, entryFileNames: "index.cjs", exports: "named" as const };

export default defineConfig({
  main: {
    build: { outDir: "dist/main", rollupOptions: { input: resolve("src/main/index.ts"), external: runtimeExternals, output } },
    plugins: [globalExternals({ "@freelensapp/extensions": "global.LensExtensions", mobx: "global.Mobx" })],
  },
  preload: {
    build: { outDir: "dist/renderer", rollupOptions: { input: resolve("src/renderer/index.tsx"), external: runtimeExternals, output } },
    plugins: [globalExternals({
      "@freelensapp/extensions": "global.LensExtensions",
      mobx: "global.Mobx",
      react: "global.React",
      "react/jsx-runtime": "global.ReactJsxRuntime",
    })],
  },
});
