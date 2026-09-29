import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useStudio } from "@/store";
import { placeholder } from "@/lib/solve";
import { Backdrop } from "./Backdrop";
import { CameraRig } from "./CameraRig";
import { Sculpture } from "./Sculpture";
import { Tile, tileFootprint } from "./Tile";
import { publishLive } from "./live";
import { SpinDriver } from "./SpinDriver";
import { Scanner } from "./Scanner";
import { useT } from "@/i18n";

/** hands the camera to the overlays every frame (see live.ts) */
function LiveCamera() {
  useFrame(({ camera }) => publishLive(camera));
  return null;
}

// three.js now measures light in physical units; × π gives the legacy brightness the colours were tuned for
const LEGACY = Math.PI;

/** a light that rides with the camera, so the face you look at is never in shadow */
function HeadLight() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const light = new THREE.DirectionalLight(0xffffff, 0.45 * LEGACY);
    light.position.set(0, 0, 1);
    camera.add(light, light.target);
    scene.add(camera);
    return () => void camera.remove(light, light.target);
  }, [camera, scene]);
  return null;
}

/** The 3D view. Lengths are in mm. */
export function Stage() {
  const t = useT();
  const result = useStudio((s) => s.result);
  const model = useStudio((s) => s.model);
  const moduleMm = useStudio((s) => s.moduleMm.sil);
  const tileMm = useStudio((s) => s.moduleMm.tile);
  const strut = useStudio((s) => s.design.strut);
  const look = useStudio((s) => s.look);
  const unconnected = useStudio((s) => s.generatedWith?.method === "free");
  // cylinders and spheres only for unconnected sculptures (they touch along lines or points)
  const shape = !unconnected && (look.shape === "cylinder" || look.shape === "sphere") ? "cube" : look.shape;
  const shown = useMemo(() => result ?? placeholder(), [result]);
  const footprint = tileFootprint(tileMm);
  const tile = model === "tile";
  const size = tile ? footprint[0] : shown.n * moduleMm * 1.25;
  return (
    <Canvas
      className="block h-full w-full touch-none"
      flat
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      dpr={[1, 3]}
      camera={{ position: [0, 0, -6000], fov: 1, near: 1, far: 10000 }}
      aria-label={t("可拖曳旋轉的 3D 模型")}
    >
      <hemisphereLight args={[0xffffff, 0x55605a, 0.55 * LEGACY]} />
      <directionalLight position={[0.3, 1, -0.2]} intensity={0.55 * LEGACY} />
      <HeadLight />
      <Backdrop backdrop={look.backdrop} backlit={model === "sil" && look.look === "sil"} floor={look.floor} model={model} size={size} footprint={footprint} />
      {tile ? (
        <Tile moduleMm={tileMm} dark={look.colors.dark} light={look.colors.light} />
      ) : (
        <Sculpture result={shown} moduleMm={moduleMm} strutWidth={strut / 100} look={look.look} colors={look.colors} shape={shape} />
      )}
      {/* the tile is never seen from under the table */}
      <CameraRig size={size} minPolar={0.001} maxPolar={tile ? Math.PI / 2 - 0.02 : Math.PI - 0.001} />
      <SpinDriver />
      <Scanner backlitForScan={model === "sil" && look.look !== "sil"} />
      <LiveCamera />
    </Canvas>
  );
}
