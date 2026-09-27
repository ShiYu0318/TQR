import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { useStudio } from "@/store";
import { placeholder } from "@/lib/solve";
import { CameraRig } from "./CameraRig";
import { Sculpture } from "./Sculpture";

/** The 3D view. Lengths are in mm; the backlit silhouette look sits on a plain white field so it can be scanned. */
export function Stage() {
  const result = useStudio((s) => s.result);
  const moduleMm = useStudio((s) => s.moduleMm.sil);
  const strut = useStudio((s) => s.design.strut);
  const shown = useMemo(() => result ?? placeholder(), [result]);
  const size = shown.n * moduleMm * 1.25;
  return (
    <Canvas
      className="block h-full w-full touch-none"
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 3]}
      camera={{ position: [0, 0, -6000], fov: 1, near: 1, far: 10000 }}
      aria-label="可拖曳旋轉的 3D 模型"
    >
      <color attach="background" args={["#ffffff"]} />
      <hemisphereLight args={[0xffffff, 0x55605a, 0.55]} />
      <directionalLight position={[0.3, 1, -0.2]} intensity={0.55} />
      <Sculpture result={shown} moduleMm={moduleMm} strutWidth={strut / 100} />
      <CameraRig size={size} minPolar={0.001} maxPolar={Math.PI - 0.001} />
    </Canvas>
  );
}
