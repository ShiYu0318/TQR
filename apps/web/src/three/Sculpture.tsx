import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { Result } from "@tqr/tri-core";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Look, Shape } from "@/store";
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
  shape: Shape;
}

const unit = new THREE.BoxGeometry(1, 1, 1);
/** cube shapes; cylinders and spheres only touch along lines or points, so they are offered for unconnected sculptures only */
const SHAPES: Record<Shape, THREE.BufferGeometry> = {
  cube: unit,
  rounded: new RoundedBoxGeometry(1, 1, 1, 2, 0.18),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sphere: new THREE.SphereGeometry(0.5, 20, 14),
};
/** what a scanner sees: black, unlit */
export const SILHOUETTE = new THREE.MeshBasicMaterial({ color: 0x000000 });
const lit = new THREE.MeshLambertMaterial({ color: 0xffffff });
const strutLit = new THREE.MeshLambertMaterial({ color: 0xc98b2e });

/** The TQR sculpture: one instanced cube per voxel and one thin box per strut, coloured by the look. */
export function Sculpture({ result, moduleMm, strutWidth, look, colors, shape }: Props) {
  const cubes = useRef<THREE.InstancedMesh>(null);
  const struts = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => occupiedCells(result), [result]);
  const facts = useMemo(() => cellFacts(result, cells), [result, cells]);
  const invalidate = useThree((s) => s.invalidate);

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
    invalidate();
  }, [result, cells, moduleMm, strutWidth, shape, invalidate]);

  useLayoutEffect(() => {
    if (!cubes.current || !struts.current) return;
    invalidate();
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
  }, [look, colors, result, cells, facts, shape, invalidate]);

  return (
    <group>
      {/* key forces a fresh buffer when the instance count changes */}
      <instancedMesh name="cubes" key={`c${cells.length}${shape}`} ref={cubes} args={[SHAPES[shape], SILHOUETTE, Math.max(1, cells.length)]} />
      <instancedMesh name="struts" key={`s${result.E.length}`} ref={struts} args={[unit, SILHOUETTE, Math.max(1, result.E.length)]} />
    </group>
  );
}
