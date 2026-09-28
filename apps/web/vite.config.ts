import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { triCore } from "@tqr/tri-core/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

const src = (p: string) => fileURLToPath(new URL("./src/" + p, import.meta.url));

// `vite build --mode single` makes the demo: one self-contained index.html (workers and wasm inlined, no service
// worker), for sending around or opening from disk. Every other mode is the normal site.
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    plugins: [
      triCore(),
      react(),
      tailwind(),
      single ? viteSingleFile() : null,
      // installable and offline: every built file (solver, workers, both wasm modules) is precached
      single
        ? null
        : VitePWA({
            registerType: "autoUpdate",
            manifest: {
              name: "TQR Studio",
              short_name: "TQR Studio",
              description: "多視角 QR 設計工作室：設計從不同方向看是不同 QR 碼的實體模型。",
              lang: "zh-Hant",
              start_url: ".",
              display: "standalone",
              background_color: "#0d1117",
              theme_color: "#0d1117",
              icons: [
                { src: "icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "icon-512.png", sizes: "512x512", type: "image/png" },
                { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
                { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,wasm,svg,png}"],
              maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
              // share links carry the design in the hash, so every navigation is the app shell
              navigateFallback: "index.html",
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
                  handler: "StaleWhileRevalidate",
                  options: { cacheName: "fonts", expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 } },
                },
              ],
            },
          }),
    ],
    // the solver worker imports the solver too
    // classic workers in the demo: a page opened from disk (origin null) cannot start module workers from blobs
    worker: { format: single ? "iife" : "es", plugins: () => [triCore()] },
    // one three.js: drei helpers hoisted to the root would otherwise pick up the root devDependency (0.147)
    resolve: {
      alias: [...(single ? [{ find: "@/lib/spawn", replacement: src("lib/spawn.single.ts") }] : []), { find: "@", replacement: src("") }],
      dedupe: ["three"],
    },
    // the solver lives in src/js at the repo root; let the dev server read it
    server: { fs: { allow: ["../.."] } },
    build: single
      ? { outDir: "dist-single", assetsInlineLimit: Number.MAX_SAFE_INTEGER, chunkSizeWarningLimit: 10000 }
      : {
          // three.js alone is ~740 kB minified and cannot be split further
          chunkSizeWarningLimit: 800,
          rolldownOptions: {
            output: {
              // libraries in their own long-lived chunks, so an app update does not re-download three.js
              codeSplitting: {
                groups: [
                  { name: "three", test: /node_modules[\\/]three[\\/]/, priority: 30 },
                  {
                    name: "r3f",
                    test: /node_modules[\\/](@react-three|three-stdlib|camera-controls|maath|troika|three-mesh-bvh|@monogrid)/,
                    priority: 25,
                  },
                  { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
                  // manifold stays out: it loads only when a mesh is exported
                  { name: "vendor", test: /node_modules[\\/](?!manifold-3d)/, priority: 10 },
                ],
              },
            },
          },
        },
    test: { environment: "node", include: ["src/**/*.test.ts"] },
  };
});
