import { useStudio } from "@/store";
import { farDistanceCm } from "@/three/geometry";
import { solve } from "./solve";

/** Run the solver on the current design, show the result and frame it (moves into a worker later). */
export function generate() {
  const { design, moduleMm, model, setResult, setBusy, requestView, resetFound } = useStudio.getState();
  try {
    const { result, links } = solve(design);
    setResult(result, links);
    resetFound("sil");
    setBusy(false);
    if (model === "sil") requestView(0, 0, farDistanceCm(result.n, moduleMm.sil));
  } catch (e) {
    setBusy(false, (e as Error).message);
  }
}
