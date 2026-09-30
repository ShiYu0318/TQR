import type { Result } from "@tqr/tri-core";
import { useStudio } from "@/store";
import { farDistanceCm } from "@/three/geometry";
import { ISO_ELEVATION } from "@/three/live";
import { prepare, solverError } from "./solve";
import { solverWorker } from "./solverClient";
import { takePendingView } from "./share";

/**
 * Run the solver (in a worker) on the current design, show the result and frame it: from the front at scanning distance,
 * or with `iso` from the isometric view that shows all three sides at once.
 */
export async function generate({ iso = false } = {}) {
  const { design, setBusy } = useStudio.getState();
  let prepared;
  try {
    prepared = prepare(design);
  } catch (e) {
    return setBusy(false, (e as Error).message);
  }
  setBusy(true);
  const out = await solverWorker().generate(prepared.spec);
  if (!out.ok) return setBusy(false, solverError(out.error));
  setBusy(false);
  showResult(out.result, prepared.links, design, iso);
}

/** Show a generated sculpture for `design` (the one on screen unless given) and frame it at scanning distance. */
export function showResult(result: Result, links: string[], design = useStudio.getState().design, iso = false) {
  const { model, moduleMm, requestView, resetFound, setResult } = useStudio.getState();
  setResult(result, links, design);
  resetFound("sil");
  if (model !== "sil") return;
  const v = takePendingView(); // a shared link can carry its own view
  const far = farDistanceCm(result.n, moduleMm.sil);
  if (v) requestView(v.az, v.el, v.cm);
  else if (iso) requestView(45, ISO_ELEVATION, far);
  else requestView(0, 0, far);
}
