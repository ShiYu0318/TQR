import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { triCore } from "@tqr/tri-core/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [triCore(), react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // the solver lives in src/js at the repo root; let the dev server read it
  server: { fs: { allow: ["../.."] } },
});
