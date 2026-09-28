// The app's two workers, each its own file next to the page. The single-file demo build swaps this module for
// spawn.single.ts (vite.config.ts), which inlines them.
export const spawnSolver = () => new Worker(new URL("../workers/solver.worker.ts", import.meta.url), { type: "module" });
export const spawnScanner = () => new Worker(new URL("../workers/scan.worker.ts", import.meta.url), { type: "module" });
