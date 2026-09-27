import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Result } from "@tqr/tri-core";
import type { Look } from "@/store";
import { cellCentre, occupiedCells, strutBox } from "./geometry";
import { cellFacts, colourCells } from "./colouring";
import type { Colors } from "./palette";

interface Props {
  result: Result;
  /** module size in mm */
  moduleMm: number;
  /** strut width as a share of a module */
  strutWidth: number;
  look: Look;
  colors: Colors;
}

const unit = new THREE.BoxGeometry(1, 1, 1);
/** what a scanner sees: black, unlit */
export const SILHOUETTE = new THREE.MeshBasicMaterial({ color: 0x000000 });
const lit = new THREE.MeshLambertMaterial({ color: 0xffffff });
const strutLit = new THREE.MeshLambertMaterial({ color: 0xc98b2e });

/** The TQR sculpture: one instanced cube per voxel and one thin box per strut, coloured by the look. */
export function Sculpture({ result, moduleMm, strutWidth, look, colors }: Props) {
  const cubes = useRef<THREE.InstancedMesh>(null);
  const struts = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => occupiedCells(result), [result]);
  const facts = useMemo(() => cellFacts(result, cells), [result, cells]);

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

  useLayoutEffect(() => {
    if (!cubes.current || !struts.current) return;
    const paint = colourCells(look, result, cells, facts, colors);
    if (!paint) {
      cubes.current.material = SILHOUETTE;
      struts.current.material = SILHOUETTE;
      return;
    }
    cubes.current.material = lit;
    struts.current.material = strutLit;
    strutLit.color.copy(paint.strut);
    const col = new THREE.Color();
    for (let i = 0; i < cells.length; i++) cubes.current.setColorAt(i, col.fromArray(paint.cubes, i * 3));
    if (cubes.current.instanceColor) cubes.current.instanceColor.needsUpdate = true;
  }, [look, colors, result, cells, facts]);

  return (
    <group>
      {/* key forces a fresh buffer when the instance count changes */}
      <instancedMesh key={`c${cells.length}`} ref={cubes} args={[unit, SILHOUETTE, Math.max(1, cells.length)]} />
      <instancedMesh key={`s${result.E.length}`} ref={struts} args={[unit, SILHOUETTE, Math.max(1, result.E.length)]} />
    </group>
  );
}
