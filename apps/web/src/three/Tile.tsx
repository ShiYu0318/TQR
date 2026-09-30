import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { TILE } from "@/lib/tile";

const unit = new THREE.BoxGeometry(1, 1, 1);

/** one filament's boxes as an instanced mesh; the tile lies on the table, its underside at y = 0 */
function Filament({ boxes, colour }: { boxes: number[]; colour: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => new THREE.MeshLambertMaterial(), []);
  const count = boxes.length / 6, { vox, dims } = TILE;
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const [x0, y0, z0, x1, y1, z1] = boxes.slice(i * 6, i * 6 + 6);
      p.set(((x0 + x1) / 2 - dims[0] / 2) * vox, ((z0 + z1) / 2) * vox, -((y0 + y1) / 2 - dims[1] / 2) * vox);
      s.set((x1 - x0) * vox, (z1 - z0) * vox, (y1 - y0) * vox);
      mesh.current!.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
    invalidate();
  }, [boxes, count, vox, dims, invalidate]);
  useLayoutEffect(() => {
    material.color.set(colour);
    invalidate();
  }, [material, colour, invalidate]);
  return <instancedMesh ref={mesh} args={[unit, material, count]} />;
}

/** The QQR five-view egg-crate demo in two filaments. The data is drawn at 5 mm per module; scale sets the real size. */
export function Tile({ moduleMm, dark, light }: { moduleMm: number; dark: string; light: string }) {
  return (
    <group scale={moduleMm / 5}>
      <Filament boxes={TILE.white} colour={light} />
      <Filament boxes={TILE.black} colour={dark} />
    </group>
  );
}

/** tile footprint (mm) at this module size: width along x, depth along y */
export function tileFootprint(moduleMm: number): [number, number] {
  const k = moduleMm / 5;
  return [TILE.dims[0] * TILE.vox * k, TILE.dims[1] * TILE.vox * k];
}
