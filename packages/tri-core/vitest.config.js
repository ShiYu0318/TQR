import { defineConfig } from "vitest/config";
import { triCore } from "./vite.js";

export default defineConfig({
  plugins: [triCore()],
  server: { fs: { allow: ["../.."] } },
});
