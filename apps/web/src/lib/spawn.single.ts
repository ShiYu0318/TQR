// Single-file demo build: the workers are inlined into the page and started from blob URLs.
import SolverWorker from "../workers/solver.worker?worker&inline";
import ScanWorker from "../workers/scan.worker?worker&inline";

export const spawnSolver = () => new SolverWorker();
export const spawnScanner = () => new ScanWorker();
