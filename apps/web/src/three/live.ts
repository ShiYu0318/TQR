import * as THREE from "three";

// The camera changes every frame; routing that through React state would re-render the page 60 times a second.
// Instead the canvas publishes it here each frame, and the few widgets that follow it (gizmo, readout, lights)
// subscribe and redraw only when what they show changes.

export const live = {
  quaternion: new THREE.Quaternion(),
  /** unit vector from the target to the camera */
  dir: new THREE.Vector3(0, 0, -1),
  azimuth: 0,
  elevation: 0,
};

const subscribers = new Set<() => void>();

export function subscribeLive(fn: () => void) {
  subscribers.add(fn);
  return () => void subscribers.delete(fn);
}

export function publishLive(camera: THREE.Camera) {
  live.quaternion.copy(camera.quaternion);
  live.dir.copy(camera.position).normalize();
  live.elevation = THREE.MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, live.dir.y))));
  let az = THREE.MathUtils.radToDeg(Math.atan2(live.dir.x, -live.dir.z));
  if (az < 0) az += 360;
  live.azimuth = az;
  subscribers.forEach((fn) => fn());
}

/** unit vector towards a camera at this azimuth / elevation (azimuth 0 = front) */
export function dirOf(azimuth: number, elevation: number, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(azimuth), e = THREE.MathUtils.degToRad(elevation);
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

/** a view button, its link and the gizmo end light while the camera is within 8° of that direction */
export const VIEW_TOL = Math.cos(THREE.MathUtils.degToRad(8));

/** the isometric view: rotate about X by atan(1/√2) ≈ 35.26°, then about Y by 45° */
export const ISO_ELEVATION = THREE.MathUtils.radToDeg(Math.atan(1 / Math.SQRT2));

/** distance slider: 0..1000 on a log scale from 20 cm to 10 m */
export const sliderToCm = (v: number) => Math.round(20 * Math.pow(50, v / 1000));
export const cmToSlider = (cm: number) => Math.round((1000 * Math.log(cm / 20)) / Math.log(50));

export function formatDistance(cm: number) {
  return cm >= 100 ? (cm / 100).toFixed(cm >= 1000 ? 0 : 1) + " m" : cm + " cm";
}
