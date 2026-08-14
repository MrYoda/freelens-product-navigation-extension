import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: "src/main/index.ts", formats: ["es"] } },
  },
  renderer: {
    build: { lib: { entry: "src/renderer/index.tsx", formats: ["es"] } },
  },
});
