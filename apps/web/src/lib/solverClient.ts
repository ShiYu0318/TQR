import * as Comlink from "comlink";
import type { SolverApi } from "@/workers/solver.worker";

let solver: Comlink.Remote<SolverApi> | null = null;

/** the solver worker, started on first use */
export function solverWorker() {
  solver ??= Comlink.wrap<SolverApi>(new Worker(new URL("../workers/solver.worker.ts", import.meta.url), { type: "module" }));
  return solver;
}
