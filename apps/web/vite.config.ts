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
  build: {
    // three.js alone is ~740 kB minified and cannot be split further
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // libraries in their own long-lived chunks, so an app update does not re-download three.js
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: "r3f", test: /node_modules[\\/](@react-three|three-stdlib|camera-controls|maath|troika|three-mesh-bvh|@monogrid)/, priority: 25 },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            // manifold stays out: it loads only when a mesh is exported
            { name: "vendor", test: /node_modules[\\/](?!manifold-3d)/, priority: 10 },
          ],
        },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
