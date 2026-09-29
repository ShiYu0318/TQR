import type { Result } from "@tqr/tri-core";

// Voxel (x, y, z) sits at (x − n/2, z − n/2, −(y − n/2)) · module in three.js:
// three's y is the sculpture's height and the front camera looks along +z.

/** the occupied cells of a result, in index order */
export function occupiedCells(r: Result): number[] {
  const out: number[] = [];
  for (let i = 0; i < r.V.length; i++) if (r.V[i]) out.push(i);
  return out;
}

export function cellXYZ(c: number, n: number): [number, number, number] {
  return [(c / (n * n)) | 0, ((c / n) | 0) % n, c % n];
}

/** centre of a cell in scene units (mm) */
export function cellCentre(c: number, n: number, s: number): [number, number, number] {
  const [x, y, z] = cellXYZ(c, n);
  return [(x + 0.5 - n / 2) * s, (z + 0.5 - n / 2) * s, -(y + 0.5 - n / 2) * s];
}

/** a strut between face-adjacent cells a < b: centre and size in scene units, width w as a share of a module */
export function strutBox(a: number, b: number, n: number, s: number, w: number) {
  const axis = b - a === n * n ? 0 : b - a === n ? 1 : 2;
  const lo = cellXYZ(a, n), size = [w, w, w];
  size[axis] = 1 + w;
  const c = [lo[0] + size[0] / 2, lo[1] + size[1] / 2, lo[2] + size[2] / 2];
  return {
    centre: [(c[0] - n / 2) * s, (c[2] - n / 2) * s, -(c[1] - n / 2) * s] as [number, number, number],
    size: [size[0] * s, size[2] * s, size[1] * s] as [number, number, number],
  };
}

/** Default camera distance for this sculpture, in cm, clamped to 4-10 m. */
export function farDistanceCm(n: number, s: number): number {
  return Math.min(1000, Math.max(400, Math.ceil((1.4 * n * n * s) / 0.6 / 10 / 50) * 50));
}
