import { useStudio } from "@/store";
import { farDistanceCm } from "@/three/geometry";
import { prepare, solverError } from "./solve";
import { solverWorker } from "./solverClient";

/** Run the solver (in a worker) on the current design, show the result and frame it. */
export async function generate() {
  const { design, setResult, setBusy } = useStudio.getState();
  let prepared;
  try {
    prepared = prepare(design);
  } catch (e) {
    return setBusy(false, (e as Error).message);
  }
  setBusy(true);
  const out = await solverWorker().generate(prepared.spec);
  if (!out.ok) return setBusy(false, solverError(out.error));
  const { model, moduleMm, requestView, resetFound } = useStudio.getState();
  setResult(out.result, prepared.links, design);
  resetFound("sil");
  setBusy(false);
  if (model === "sil") requestView(0, 0, farDistanceCm(out.result.n, moduleMm.sil));
}
