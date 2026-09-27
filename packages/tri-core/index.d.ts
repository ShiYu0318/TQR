// Types for the TQR solver in src/js/tri_core.js. Images are flat n*n arrays indexed i*n + j with (i, j) = (x, y) for
// the top view, (x, z) for the front and (y, z) for the side. Cells are indexed x*n*n + y*n + z.

export type Level = "L" | "M" | "Q" | "H";
export type Mode = "3qr" | "2qr_wall" | "2qr_logo";
export type Method = "bridge+strut" | "bridge" | "strut" | "free" | "dust";
export type ViewKind = "qr" | "wall" | "logo";

/** Codeword map of one QR version and level (mirrors qrstruct.structure). */
export interface Structure {
  n: number;
  version: number;
  level: Level;
  /** 1 where the module belongs to a function pattern */
  func: Uint8Array;
  /** function class per module: 1 finder, 2 separator, 3 timing, 4 alignment, 5 format/version, 6 dark module */
  fclass: Int8Array;
  /** codeword index per module; -1 function, -2 remainder */
  cw: Int32Array;
  /** block of each codeword */
  blk: Int32Array;
  /** correctable codewords per block, floor((ec - p) / 2) */
  cap: Int32Array;
  total: number;
  nec: number[];
}

/** Certificate of one QR view: function modules exact and per-block bad codewords within capacity. */
export interface Certificate {
  ok: boolean;
  funcErrors: number;
  blockErrors: number[];
  cap: number[];
  wrong: number;
  badCodewords: number;
  /** error budget per block that bridging may spend */
  budget?: number[];
  /** codewords per block already spent by a centre logo, or null */
  logoBlocks?: number[] | null;
}

/** Check of a wall or logo view. */
export interface ImageCheck {
  ok: boolean;
  flips: number;
  missing: number;
}

export interface Overlay {
  /** n*n mask of the logo area */
  region: Uint8Array;
  /** n*n target pixels inside the area (1 = dark) */
  pixels: Uint8Array;
}

export interface Spec {
  /** 2 or 3 QR matrices, n*n each */
  qr: Uint8Array[];
  version: number;
  level?: Level;
  mode: Mode;
  /** n*n side image for "2qr_logo" */
  logo?: Uint8Array;
  method: Method;
  /** allow bridges over separator, timing and alignment patterns (not certified) */
  relaxed?: boolean;
  /** share of each block's capacity bridging may use (default 0.5) */
  budget?: number;
  /** share of logo pixels that may flip */
  logoBudget?: number;
  /** centre logo per QR view (null for none) */
  overlays?: (Overlay | null)[];
}

export interface Result {
  n: number;
  version: number;
  /** n^3 voxels, 1 = material */
  V: Uint8Array;
  /** struts as [cell a, cell b] pairs of face-adjacent cells */
  E: [number, number][];
  /** 1 on cells added as bridges, or null */
  bridgeMask: Uint8Array | null;
  cubes: number;
  struts: number;
  pieces: number;
  mainShare: number;
  onePiece: boolean;
  /** one entry per view: a certificate for QR views, a check for wall and logo views */
  evals: (Certificate | ImageCheck)[];
  kinds: ViewKind[];
  info: { bridges?: number; seeds?: number; orphans?: number };
  ms: number;
}

export interface Tri {
  setTables(tables: unknown): void;
  structure(version: number, level: Level): Structure;
  functionClasses(version: number): Int8Array;
  certificate(projection: Uint8Array, target: Uint8Array, S: Structure): Certificate;
  generate(spec: Spec): Result;
  logoRaw(kind: string, n: number): Uint8Array;
  badge(raw: Uint8Array, n: number): Uint8Array;
  feasibleSet(views: unknown[], n: number): Uint8Array;
  /** the three orthographic projections of V */
  project(V: Uint8Array, n: number): Uint8Array[];
  components(V: Uint8Array, n: number): { pieces: number; mainShare: number };
  label(V: Uint8Array, n: number): { lab: Int32Array; K: number; sizes: number[] };
}

declare const TRI: Tri;
export default TRI;
