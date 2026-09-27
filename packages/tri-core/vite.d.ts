import type { Plugin } from "vite";

/** Makes src/js/tri_core.js importable as an ES module (appends `export default TRI`). */
export function triCore(): Plugin;
