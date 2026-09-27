import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Result } from "@tqr/tri-core";
import { cellCentre, occupiedCells, strutBox } from "./geometry";

interface Props {
  result: Result;
  /** module size in mm */
  moduleMm: number;
  /** strut width as a share of a module */
  strutWidth: number;
}

const unit = new THREE.BoxGeometry(1, 1, 1);
const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

/** The TQR sculpture: one instanced cube per voxel and one thin box per strut (backlit silhouette look). */
export function Sculpture({ result, moduleMm, strutWidth }: Props) {
  const cubes = useRef<THREE.InstancedMesh>(null);
  const struts = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => occupiedCells(result), [result]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const { n } = result, s = moduleMm;
    if (cubes.current) {
      sc.setScalar(s);
      cells.forEach((c, i) => cubes.current!.setMatrixAt(i, m.compose(p.set(...cellCentre(c, n, s)), q, sc)));
      cubes.current.count = cells.length;
      cubes.current.instanceMatrix.needsUpdate = true;
      cubes.current.computeBoundingSphere();
    }
    if (struts.current) {
      result.E.forEach(([a, b], i) => {
        const { centre, size } = strutBox(a, b, n, s, strutWidth);
        struts.current!.setMatrixAt(i, m.compose(p.set(...centre), q, sc.set(...size)));
      });
      struts.current.count = result.E.length;
      struts.current.instanceMatrix.needsUpdate = true;
      struts.current.computeBoundingSphere();
    }
  }, [result, cells, moduleMm, strutWidth]);

  return (
    <group>
      {/* key forces a fresh buffer when the instance count grows */}
      <instancedMesh key={`c${cells.length}`} ref={cubes} args={[unit, black, Math.max(1, cells.length)]} />
      <instancedMesh key={`s${result.E.length}`} ref={struts} args={[unit, black, Math.max(1, result.E.length)]} />
    </group>
  );
}
