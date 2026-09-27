import { useEffect } from "react";
import { Header } from "@/components/Header";
import { LeftSidebar, RightSidebar } from "@/components/Sidebars";
import { StageView } from "@/stage/StageView";
import { farDistanceCm } from "@/three/geometry";
import { generate } from "@/lib/actions";
import { useStudio } from "@/store";

// Layout matches reference.html: header on top, settings left and right of the 3D stage,
// numbers and checks under it.
export function App() {
  useEffect(() => generate(), []);
  // each model opens on its own view: the sculpture from the front at scanning distance, the tile from the north
  const model = useStudio((s) => s.model);
  useEffect(() => {
    const s = useStudio.getState();
    s.setCamera({ spin: null });
    if (model === "tile") s.requestView(0, 40, 30);
    else if (s.result) s.requestView(0, 0, farDistanceCm(s.result.n, s.moduleMm.sil));
  }, [model]);
  return (
    <div className="app">
      <Header />
      <LeftSidebar />
      <StageView />
      <RightSidebar />
      <section className="area-bottom grid grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] gap-3 max-[900px]:grid-cols-1" aria-label="數字資訊與檢查結果">
        <div className="rounded-lg border border-rule bg-panel" />
        <div className="rounded-lg border border-rule bg-panel" />
      </section>
    </div>
  );
}
