import * as THREE from "three";
import TRI, { type Result } from "@tqr/tri-core";
import type { Look } from "@/store";
import { cellXYZ } from "./geometry";
import { GRADIENTS, PIECE_PALETTES, type Colors } from "./palette";

/** per-cell facts the looks need, computed once per result */
export interface CellFacts {
  /** cell projects into a finder square (7×7 corner) of some QR view */
  finder: boolean[];
  /** piece label of each cell, and the label of the largest piece */
  piece: number[];
  mainPiece: number;
}

export function cellFacts(r: Result, cells: number[]): CellFacts {
  const { n } = r, qr = r.kinds.map((k) => k === "qr");
  const inFinder = (a: number, b: number) => (a < 7 && b < 7) || (a < 7 && b >= n - 7) || (a >= n - 7 && b < 7);
  const finder = cells.map((c) => {
    const [x, y, z] = cellXYZ(c, n);
    return (qr[0] && inFinder(x, y)) || (qr[1] && inFinder(x, z)) || (!!qr[2] && inFinder(y, z));
  });
  const { lab, sizes } = TRI.label(r.V, n);
  let mainPiece = 1;
  for (let k = 1; k < sizes.length; k++) if (sizes[k] > (sizes[mainPiece] ?? 0)) mainPiece = k;
  return { finder, piece: cells.map((c) => lab[c]), mainPiece };
}

function gradientStops(colors: Colors): THREE.Color[] | null {
  if (colors.fill !== "gradient") return null;
  const stops = colors.gradient === "custom" ? [colors.gradA, colors.gradB] : (GRADIENTS[colors.gradient] ?? GRADIENTS.ocean);
  return stops.map((c) => new THREE.Color(c));
}

function gradientAt(stops: THREE.Color[], t: number, out: THREE.Color) {
  const f = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f));
  return out.copy(stops[i]).lerp(stops[i + 1], f - i);
}

/** where a cell sits along the gradient direction; x runs right to left and y back to front as seen from the front */
function gradientT(c: number, n: number, dir: Colors["gradDir"]) {
  const [x, y, z] = cellXYZ(c, n), m = Math.max(1, n - 1);
  if (dir === "lr") return 1 - x / m;
  if (dir === "fb") return 1 - y / m;
  if (dir === "diag") return (1 - x / m + z / m + (1 - y / m)) / 3;
  return z / m;
}

/**
 * Colour of every cube and of the struts for a look. The backlit look is plain black (returns null colours).
 * real: model colour (finders their own colour, a two-material print) or a gradient, which finders follow too.
 * solid: legal cubes / bridge cubes / struts. pieces: the largest piece, then the palette in turn.
 */
export function colourCells(look: Look, r: Result, cells: number[], facts: CellFacts, colors: Colors) {
  if (look === "sil") return null;
  const out = new Float32Array(cells.length * 3), col = new THREE.Color();
  let strut = new THREE.Color(colors.strut);
  const put = (i: number, c: THREE.Color) => c.toArray(out, i * 3);
  if (look === "real") {
    const model = new THREE.Color(colors.model), finder = new THREE.Color(colors.finder), G = gradientStops(colors);
    cells.forEach((c, i) => put(i, facts.finder[i] && !G ? finder : G ? gradientAt(G, gradientT(c, r.n, colors.gradDir), col) : model));
    strut = G ? gradientAt(G, 0.5, new THREE.Color()) : model;
  } else if (look === "solid") {
    const base = new THREE.Color(colors.base), bridge = new THREE.Color(colors.bridge);
    cells.forEach((c, i) => put(i, r.bridgeMask && r.bridgeMask[c] ? bridge : base));
  } else {
    const main = new THREE.Color(colors.main), pal = PIECE_PALETTES[colors.palette] ?? PIECE_PALETTES.default;
    cells.forEach((_, i) => put(i, facts.piece[i] === facts.mainPiece ? main : col.setHex(pal[facts.piece[i] % pal.length])));
  }
  return { cubes: out, strut };
}
