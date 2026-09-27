import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { triCore } from "@tqr/tri-core/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [triCore(), react(), tailwind()],
  // the solver worker imports the solver too
  worker: { format: "es", plugins: () => [triCore()] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // the solver lives in src/js at the repo root; let the dev server read it
  server: { fs: { allow: ["../.."] } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
