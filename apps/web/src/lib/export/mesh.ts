// Printable meshes: fine voxel mask → greedy
// box decomposition → exact union with manifold (WebAssembly, loaded on first use) → vertices welded at float32.
import type { Result } from "@tqr/tri-core";

type Box = [number, number, number, number, number, number];

export interface Mesh {
  verts: Float32Array;
  tris: Uint32Array;
  /** every edge has exactly two faces */
  closed: boolean;
  /** connected solids */
  pieces: number;
  /** how far each box was grown so touching boxes fuse (mm) */
  overlap: number;
}

export interface Part {
  name: string;
  color: string;
  boxes: Box[];
  /** mm per grid unit */
  scale: number;
}

/** mirrors boxes_from_mask: cover a 0/1 grid with boxes grown along x, then y, then z */
export function boxesFromMask(mask: Uint8Array, X: number, Y: number, Z: number): Box[] {
  const M = mask.slice(), idx = (x: number, y: number, z: number) => (x * Y + y) * Z + z, out: Box[] = [];
  for (let x = 0; x < X; x++)
    for (let y = 0; y < Y; y++)
      for (let z = 0; z < Z; z++) {
        if (!M[idx(x, y, z)]) continue;
        let x1 = x;
        while (x1 + 1 < X && M[idx(x1 + 1, y, z)]) x1++;
        let y1 = y;
        outerY: while (y1 + 1 < Y) {
          for (let a = x; a <= x1; a++) if (!M[idx(a, y1 + 1, z)]) break outerY;
          y1++;
        }
        let z1 = z;
        outerZ: while (z1 + 1 < Z) {
          for (let a = x; a <= x1; a++) for (let b = y; b <= y1; b++) if (!M[idx(a, b, z1 + 1)]) break outerZ;
          z1++;
        }
        for (let a = x; a <= x1; a++) for (let b = y; b <= y1; b++) for (let c = z; c <= z1; c++) M[idx(a, b, c)] = 0;
        out.push([x, y, z, x1 + 1, y1 + 1, z1 + 1]);
      }
  return out;
}

/** TQR cubes as k³ fine voxels; `keep` filters cubes */
export function sculptureMask(r: Result, k: number, keep?: (cell: number) => boolean) {
  const n = r.n, N = n * k, F = new Uint8Array(N * N * N), n2 = n * n, idx = (x: number, y: number, z: number) => (x * N + y) * N + z;
  for (let c = 0; c < r.V.length; c++) {
    if (!r.V[c] || (keep && !keep(c))) continue;
    const z = c % n, y = ((c / n) | 0) % n, x = (c / n2) | 0;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) for (let d = 0; d < k; d++) F[idx(x * k + a, y * k + b, z * k + d)] = 1;
  }
  return { F, N };
}

/** struts one fine voxel wide on module-corner lines */
export function addStruts(F: Uint8Array, N: number, r: Result, k: number) {
  const n = r.n, n2 = n * n, fine = (c: number) => [((c / n2) | 0) * k, (((c / n) | 0) % n) * k, (c % n) * k];
  for (const [u, v] of r.E ?? []) {
    const pu = fine(u), pv = fine(v), lo = pu.map((x, i) => Math.min(x, pv[i])), hi = pu.map((x, i) => Math.max(x, pv[i]));
    for (let a = lo[0]; a <= hi[0]; a++) for (let b = lo[1]; b <= hi[1]; b++) for (let d = lo[2]; d <= hi[2]; d++) if (a < N && b < N && d < N) F[(a * N + b) * N + d] = 1;
  }
}

/** merge vertices at their float32 positions (what an STL stores), drop collapsed triangles, check every edge has two faces */
export function weldMesh(vp: ArrayLike<number>, np: number, triVerts: ArrayLike<number>) {
  const map = new Map<string, number>(), verts: number[] = [], remap = new Uint32Array(vp.length / np);
  for (let i = 0, j = 0; i < vp.length; i += np, j++) {
    const x = Math.fround(vp[i]), y = Math.fround(vp[i + 1]), z = Math.fround(vp[i + 2]), key = x + "," + y + "," + z;
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      map.set(key, id);
      verts.push(x, y, z);
    }
    remap[j] = id;
  }
  const tris: number[] = [];
  for (let i = 0; i < triVerts.length; i += 3) {
    const a = remap[triVerts[i]], b = remap[triVerts[i + 1]], c = remap[triVerts[i + 2]];
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  const edges = new Map<number, number>();
  for (let i = 0; i < tris.length; i += 3)
    for (let s = 0; s < 3; s++) {
      const a = tris[i + s], b = tris[i + ((s + 1) % 3)], key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  let open = 0;
  edges.forEach((v) => v !== 2 && open++);
  return { verts: Float32Array.from(verts), tris: Uint32Array.from(tris), closed: open === 0 };
}

// ---- manifold (WebAssembly), loaded on first use
let wasmUrl: string | undefined;
/** where the browser build finds manifold.wasm (Node finds it next to the module on its own) */
export function setManifoldWasm(url: string) {
  wasmUrl = url;
}
let lib: Promise<{ Manifold: ManifoldStatic }> | null = null;
interface ManifoldObject {
  translate(v: [number, number, number]): ManifoldObject;
  getMesh(): { vertProperties: Float32Array; numProp: number; triVerts: Uint32Array };
  decompose(): ManifoldObject[];
  delete(): void;
}
interface ManifoldStatic {
  cube(size: [number, number, number]): ManifoldObject;
  union(parts: ManifoldObject[]): ManifoldObject;
}
export function manifoldLib() {
  lib ??= import("manifold-3d").then(async ({ default: Module }) => {
    const wasm = await Module(wasmUrl ? { locateFile: () => wasmUrl! } : undefined);
    wasm.setup();
    return wasm as unknown as { Manifold: ManifoldStatic };
  });
  return lib;
}

/**
 * Exact union of boxes (grid units × scale mm). Exactly touching boxes do not fuse, so each is grown by a hair; if the
 * result still has open edges (hairline slits below float32 resolution) the growth is increased.
 */
export async function unionBoxes(boxes: Box[], scale: number): Promise<Mesh> {
  const { Manifold } = await manifoldLib();
  let out: Mesh | null = null;
  for (const e of [2e-3, 5e-3, 1e-2]) {
    const parts = boxes.map((b) =>
      Manifold.cube([(b[3] - b[0]) * scale + 2 * e, (b[4] - b[1]) * scale + 2 * e, (b[5] - b[2]) * scale + 2 * e]).translate([b[0] * scale - e, b[1] * scale - e, b[2] * scale - e]),
    );
    const u = Manifold.union(parts), mesh = u.getMesh(), pieces = u.decompose();
    out = { ...weldMesh(mesh.vertProperties, mesh.numProp, mesh.triVerts), pieces: pieces.length, overlap: e };
    parts.forEach((m) => m.delete());
    pieces.forEach((m) => m.delete());
    u.delete();
    if (out.closed) break;
  }
  return out!;
}

/**
 * The sculpture as printable parts: the body (cubes + struts) and, as a second part, the cubes under the finder
 * squares, so a two-material printer can give the finders their own colour. Strut width sets the fine grid: k = 1/width.
 */
export function sculptureParts(r: Result, strutWidth: number, moduleMm: number, finder: Set<number>, colors: { model: string; finder: string }): Part[] {
  const k = Math.max(2, Math.round(1 / strutWidth)), s = moduleMm / k;
  const body = sculptureMask(r, k, finder.size ? (c) => !finder.has(c) : undefined);
  addStruts(body.F, body.N, r, k);
  const parts: Part[] = [{ name: "body", color: colors.model, boxes: boxesFromMask(body.F, body.N, body.N, body.N), scale: s }];
  if (finder.size) {
    const f = sculptureMask(r, k, (c) => finder.has(c));
    parts.push({ name: "finder", color: colors.finder, boxes: boxesFromMask(f.F, f.N, f.N, f.N), scale: s });
  }
  return parts;
}

/** the egg-crate tile's two filaments (box lists in voxels, drawn at 5 mm per module) */
export function tileParts(tile: { vox: number; white: number[]; black: number[] }, moduleMm: number, colors: { dark: string; light: string }): Part[] {
  const s = (tile.vox * moduleMm) / 5, group = (flat: number[]) => {
    const b: Box[] = [];
    for (let i = 0; i < flat.length; i += 6) b.push(flat.slice(i, i + 6) as Box);
    return b;
  };
  return [
    { name: "light", color: colors.light, boxes: group(tile.white), scale: s },
    { name: "dark", color: colors.dark, boxes: group(tile.black), scale: s },
  ];
}
