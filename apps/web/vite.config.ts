import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { triCore } from "@tqr/tri-core/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [triCore(), react(), tailwind()],
  // the solver worker imports the solver too
  worker: { format: "es", plugins: () => [triCore()] },
  // one three.js: drei helpers hoisted to the root would otherwise pick up the root devDependency (0.147)
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }, dedupe: ["three"] },
  // the solver lives in src/js at the repo root; let the dev server read it
  server: { fs: { allow: ["../.."] } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
