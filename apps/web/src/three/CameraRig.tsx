import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useStudio } from "@/store";

interface Props {
  /** framing size of the model in scene units (mm) */
  size: number;
  minPolar: number;
  maxPolar: number;
}

const D2R = THREE.MathUtils.degToRad;

/** unit vector from the target to a camera at this azimuth / elevation (azimuth 0 = front, looking along +z) */
export function viewDirection(azimuth: number, elevation: number, out = new THREE.Vector3()) {
  const a = D2R(azimuth), e = D2R(Math.max(-89.9, Math.min(89.9, elevation)));
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

/**
 * Distance is a dolly zoom: the field of view narrows as the camera backs off, so the model keeps its size on screen
 * and only the perspective weakens (at 10 m it is close to orthographic, like a telephoto shot).
 */
export function CameraRig({ size, minPolar, maxPolar }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<OrbitControlsImpl>(null);
  const distanceCm = useStudio((s) => s.camera.distanceCm);
  const request = useStudio((s) => s.viewRequest);
  const setCamera = useStudio((s) => s.setCamera);
  const applied = useRef(-1);

  useEffect(() => {
    const d = distanceCm * 10;
    camera.fov = 2 * THREE.MathUtils.radToDeg(Math.atan((size * 0.72) / d));
    camera.near = Math.max(1, d - size * 2);
    camera.far = d + size * 2;
    camera.updateProjectionMatrix();
    camera.position.setLength(d);
    controls.current?.update();
    invalidate();
  }, [camera, distanceCm, size, invalidate]);

  useEffect(() => {
    if (request.id === applied.current) return;
    applied.current = request.id;
    if (request.distanceCm && request.distanceCm !== distanceCm) setCamera({ distanceCm: request.distanceCm });
    const d = (request.distanceCm ?? distanceCm) * 10;
    camera.up.set(0, 1, 0);
    camera.position.copy(viewDirection(request.azimuth, request.elevation)).multiplyScalar(d);
    controls.current?.update();
    invalidate();
  }, [request, camera, distanceCm, setCamera, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.12}
      minPolarAngle={minPolar}
      maxPolarAngle={maxPolar}
    />
  );
}
