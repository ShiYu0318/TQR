import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStudio } from "@/store";
import { live } from "./live";

const D = THREE.MathUtils.degToRad, Y = new THREE.Vector3(0, 1, 0);

/**
 * Auto rotation; every mode runs until pressed again or the view is dragged.
 * v: vertical turns through top and bottom (the tile swings over its top to the far side and back, never under the table).
 * h: horizontal turns. free: a tumble along a vertical great circle that slowly turns, so every face comes round.
 * The orbit controls are paused meanwhile (they would clamp the camera at the poles).
 */
export function SpinDriver() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { update(): void } | null;
  const spin = useStudio((s) => s.camera.spin);
  const model = useStudio((s) => s.model);
  const state = useRef({ t: 0, az: 0, el: 0, c: 0 });
  const h = useRef(new THREE.Vector3()), dir = useRef(new THREE.Vector3()), up = useRef(new THREE.Vector3());

  useEffect(() => {
    if (spin) {
      const el = live.elevation;
      state.current = { t: 0, az: live.azimuth, el, c: Math.acos(Math.max(-1, Math.min(1, (50 - el) / 35))) };
      return;
    }
    camera.up.set(0, 1, 0); // stopped: back to an upright camera, handed to the orbit controls
    camera.lookAt(0, 0, 0);
    controls?.update();
  }, [spin, camera, controls]);

  useFrame(({ invalidate }, delta) => {
    if (!spin) return;
    invalidate(); // the canvas draws on demand: keep asking while spinning
    const s = state.current, speed = useStudio.getState().camera.spinSpeed, tile = model === "tile";
    s.t += speed * Math.min(0.1, delta);
    let az = s.az, th: number;
    if (spin === "h") th = s.el, (az += s.t);
    else if (spin === "v") th = tile ? 90 - Math.max(90 - s.el, 15) * Math.cos(D(s.t)) : s.el + s.t;
    else if (tile) (az += s.t), (th = 50 - 35 * Math.cos(D(s.t * 0.5) + s.c));
    else (az += s.t * 0.23), (th = s.el + s.t);
    h.current.set(Math.sin(D(az)), 0, -Math.cos(D(az)));
    dir.current.copy(h.current).multiplyScalar(Math.cos(D(th))).addScaledVector(Y, Math.sin(D(th)));
    if (spin === "h") up.current.copy(Y);
    else up.current.copy(h.current).multiplyScalar(-Math.sin(D(th))).addScaledVector(Y, Math.cos(D(th)));
    camera.position.copy(dir.current).multiplyScalar(useStudio.getState().camera.distanceCm * 10);
    camera.up.copy(up.current);
    camera.lookAt(0, 0, 0);
  });
  return null;
}
