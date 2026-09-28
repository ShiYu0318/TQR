import * as Comlink from "comlink";
import type { SolverApi } from "@/workers/solver.worker";
import { spawnSolver } from "@/lib/spawn";

let solver: Comlink.Remote<SolverApi> | null = null;

/** the solver worker, started on first use */
export function solverWorker() {
  solver ??= Comlink.wrap<SolverApi>(spawnSolver());
  return solver;
}
