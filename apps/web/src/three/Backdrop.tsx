import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Model } from "@/store";
import { BACKDROPS, type Backdrop as BackdropSpec } from "./palette";

interface Props {
  backdrop: string;
  /** the backlit silhouette: a plain white field and no floor, which is what makes it scannable */
  backlit: boolean;
  floor: boolean;
  model: Model;
  /** framing size of the model (mm): the floor and shadow scale with it */
  size: number;
}

function skyTexture(stops: BackdropSpec["sky"]) {
  const cv = document.createElement("canvas");
  cv.width = 4;
  cv.height = 256;
  const g = cv.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTexture(stops: [number, string][]) {
  const S = 256, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!, gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a flat colour (plus grid and axis lines) that fades out radially into the sky */
function floorTexture(b: BackdropSpec) {
  const S = 512, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = `rgb(${b.floor})`;
  g.fillRect(0, 0, S, S);
  if (b.grid) {
    g.strokeStyle = b.grid;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let i = 0; i <= S; i += S / 32) {
      g.moveTo(i, 0);
      g.lineTo(i, S);
      g.moveTo(0, i);
      g.lineTo(S, i);
    }
    g.stroke();
  }
  if (b.axes) {
    // X runs left to right (red), Y runs front to back (green), both through the model's centre
    g.lineWidth = 2.5;
    g.strokeStyle = "rgba(214,72,86,.9)";
    g.beginPath();
    g.moveTo(0, S / 2);
    g.lineTo(S, S / 2);
    g.stroke();
    g.strokeStyle = "rgba(128,184,48,.9)";
    g.beginPath();
    g.moveTo(S / 2, 0);
    g.lineTo(S / 2, S);
    g.stroke();
  }
  g.globalCompositeOperation = "destination-in";
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  r.addColorStop(0, "rgba(0,0,0,1)");
  r.addColorStop(0.5, "rgba(0,0,0,1)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const WHITE = new THREE.Color(0xffffff);
const FLOOR_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(25));

/**
 * Sky, floor and contact shadow. The silhouette sculpture floats, so its floor behaves like a turntable studio: it
 * stays put on screen, seen from 25° above and right under the model, whichever way the model turns. The egg-crate
 * tile really lies on its floor, so there the floor stays fixed in the world.
 */
export function Backdrop({ backdrop, backlit, floor, model, size }: Props) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const spec = BACKDROPS[backdrop] ?? BACKDROPS.graphite;
  const sky = useMemo(() => skyTexture(spec.sky), [spec]);
  const floorMap = useMemo(() => floorTexture(spec), [spec]);
  const shadowMap = useMemo(
    () => radialTexture([[0, `rgba(0,0,0,${spec.shadow})`], [0.55, `rgba(0,0,0,${(spec.shadow * 0.5).toFixed(2)})`], [1, "rgba(0,0,0,0)"]]),
    [spec],
  );
  useEffect(() => () => [sky, floorMap, shadowMap].forEach((t) => t.dispose()), [sky, floorMap, shadowMap]);
  useEffect(() => {
    scene.background = backlit ? WHITE : sky;
  }, [scene, backlit, sky]);

  const group = useRef<THREE.Group>(null);
  const floorMesh = useRef<THREE.Mesh>(null);
  const shadowMesh = useRef<THREE.Mesh>(null);
  const up = useMemo(() => new THREE.Vector3(), []);
  const S = size / 1.25;

  useFrame(() => {
    if (!group.current || !floorMesh.current || !shadowMesh.current) return;
    if (model !== "sil") {
      group.current.quaternion.identity();
      return;
    }
    group.current.quaternion.copy(camera.quaternion).multiply(FLOOR_TILT);
    // sit the floor just under the cube's lowest point along the tilted up direction (0.5-0.87 of its side deep)
    up.set(0, 1, 0).applyQuaternion(group.current.quaternion);
    const low = (S / 2) * (Math.abs(up.x) + Math.abs(up.y) + Math.abs(up.z));
    floorMesh.current.position.y = -low - 0.8;
    shadowMesh.current.position.y = -low - 0.4;
  });

  if (backlit || !floor) return null;
  return (
    <group ref={group}>
      <mesh ref={floorMesh} rotation-x={-Math.PI / 2} scale={[S * 4, S * 4, 1]} renderOrder={-2}>
        <planeGeometry />
        <meshBasicMaterial map={floorMap} transparent depthWrite={false} />
      </mesh>
      <mesh ref={shadowMesh} rotation-x={-Math.PI / 2} scale={[S * 1.6, S * 1.6, 1]} renderOrder={-1}>
        <planeGeometry />
        <meshBasicMaterial map={shadowMap} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
