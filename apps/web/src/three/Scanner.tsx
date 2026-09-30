import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SILHOUETTE } from "./Sculpture";

/** renders the frame a scanner would see and returns its pixels; set by <Scanner/> while the canvas lives */
export let captureScan: (() => Promise<ImageData>) | null = null;
/** the view exactly as on screen, as a PNG; set by <Scanner/> while the canvas lives */
export let captureView: (() => Promise<Blob>) | null = null;

const WHITE = new THREE.Color(0xffffff);
const MIN_WIDTH = 900; // rendered frames below ~900 px wide decode poorly
const MAX_WIDTH = 1200; // the decoder halves the frame first anyway; more pixels only cost read-back and decode time

/**
 * What a scanner sees of the sculpture is its backlit silhouette, whatever look is on screen: for another look, draw
 * that silhouette (black cubes, white field, no floor) into an off-screen target at least 900 px wide, read it, and
 * put the look back. The on-screen canvas is never touched, so nothing flickers. The frame is read back
 * asynchronously, so the page never waits for the GPU to finish it.
 */
export function Scanner({ backlitForScan }: { backlitForScan: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(size.width * gl.getPixelRatio()))), h = Math.round(w / aspect);
    const target = new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    const buffer = new Uint8Array(w * h * 4);
    captureScan = async () => {
      const swaps: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
      const background = scene.background, hidden: THREE.Object3D[] = [];
      if (backlitForScan) {
        scene.traverse((o) => {
          if (o.name === "cubes" || o.name === "struts") swaps.push([o as THREE.Mesh, (o as THREE.Mesh).material]), ((o as THREE.Mesh).material = SILHOUETTE);
          if (o.name === "studio" && o.visible) hidden.push(o), (o.visible = false);
        });
        scene.background = WHITE;
      }
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      swaps.forEach(([m, mat]) => (m.material = mat));
      hidden.forEach((o) => (o.visible = true));
      scene.background = background;
      await gl.readRenderTargetPixelsAsync(target, 0, 0, w, h, buffer);
      const flipped = new Uint8ClampedArray(w * h * 4); // handed over to the scan worker
      for (let y = 0; y < h; y++) flipped.set(buffer.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // GL rows run bottom-up
      return new ImageData(flipped, w, h);
    };
    captureView = () => {
      gl.render(scene, camera);
      return new Promise((res, rej) => gl.domElement.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
    };
    return () => {
      captureScan = null;
      captureView = null;
      target.dispose();
    };
  }, [gl, scene, camera, size, backlitForScan]);
  return null;
}
