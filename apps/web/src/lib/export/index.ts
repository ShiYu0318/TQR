// What the output panel downloads: printable meshes of the model on screen, the silhouette QR of one view, or the view.
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { useStudio } from "@/store";
import { cellFacts } from "@/three/colouring";
import { farDistanceCm, occupiedCells } from "@/three/geometry";
import { captureView } from "@/three/Scanner";
import { TILE } from "@/lib/tile";
import { t } from "@/i18n";
import { objText, saveBlob, stlBinary, threeMF } from "./formats";
import { sculptureParts, setManifoldWasm, tileParts, unionBoxes, type Part } from "./mesh";
import { silhouetteImage, silhouettePng, silhouetteSvg } from "./twoD";

setManifoldWasm(wasmUrl);

export type Format = "stl" | "obj" | "3mf" | "png-view" | "png-qr" | "svg-qr";
export const FORMATS: [Format, string][] = [
  ["stl", "STL（單一實體）"],
  ["obj", "OBJ（單一實體）"],
  ["3mf", "3MF（雙色零件）"],
  ["png-view", "PNG（目前畫面）"],
  ["png-qr", "PNG（QR 剪影）"],
  ["svg-qr", "SVG（QR 剪影）"],
];
export const VIEW_FILE = ["top", "front", "side"];

export interface ExportOptions {
  format: Format;
  /** file name without extension */
  name: string;
  /** 2D QR: which view (0 top, 1 front, 2 side) and how many light modules around it */
  view: number;
  border: number;
}

export class NoModel extends Error {
  constructor() {
    super(t("請先產生模型。"));
  }
}

/** a name safe on every file system; empty means "tqr" */
export function fileBase(name: string) {
  return (name.trim() || "tqr").replace(/[\\/:*?"<>|]+/g, "-");
}

/** the overall size, and for the sculpture how far away its silhouettes read */
export function sizeNote(): string {
  const { model, moduleMm, result } = useStudio.getState();
  const cm = (x: number) => (x / 10).toFixed(1);
  if (model === "tile") {
    const u = (TILE.vox * moduleMm.tile) / 5, d = TILE.dims;
    return t("總尺寸 {w} × {h} × {d} cm。", { w: cm(d[0] * u), h: cm(d[1] * u), d: cm(d[2] * u) });
  }
  if (!result) return "";
  const side = cm(result.n * moduleMm.sil);
  return (
    t("總尺寸 {w} × {h} × {d} cm。", { w: side, h: side, d: side }) +
    " " +
    t("剪影要在約 {m} m 外拍攝（視差限制和實際尺寸成正比）。", { m: (farDistanceCm(result.n, moduleMm.sil) / 100).toFixed(0) })
  );
}

/** the printable parts of the model on screen */
export function modelParts(): Part[] {
  const { model, moduleMm, result, design, look } = useStudio.getState();
  if (model === "tile") return tileParts(TILE, moduleMm.tile, look.colors);
  if (!result) throw new NoModel();
  const cells = occupiedCells(result), facts = cellFacts(result, cells);
  const finder = new Set(cells.filter((_, i) => facts.finder[i]));
  return sculptureParts(result, design.strut / 100, moduleMm.sil, finder, look.colors);
}

/** build and save the file; returns the line the panel shows */
export async function download(o: ExportOptions): Promise<string> {
  const base = fileBase(o.name);
  if (o.format === "png-view") {
    if (!captureView) throw new Error(t("畫面還沒準備好。"));
    const name = base + "-view.png";
    saveBlob(await captureView(), name);
    return t("已下載 {f}。", { f: name });
  }
  if (o.format === "png-qr" || o.format === "svg-qr") {
    const { result } = useStudio.getState();
    if (!result) throw new NoModel();
    const { n, S } = silhouetteImage(result, o.view), name = `${base}-${VIEW_FILE[o.view]}.${o.format === "svg-qr" ? "svg" : "png"}`;
    saveBlob(o.format === "svg-qr" ? new Blob([silhouetteSvg(n, S, o.border)], { type: "image/svg+xml" }) : await silhouettePng(n, S, o.border), name);
    return t("已下載 {f}。", { f: name });
  }
  const parts = modelParts(), meshes = [];
  for (const p of parts) meshes.push({ name: p.name, color: p.color, mesh: await unionBoxes(p.boxes, p.scale) });
  let blob: Blob, name: string, tris: number, pieces: string | number, closed: boolean;
  if (o.format === "3mf") {
    blob = threeMF(meshes);
    name = base + ".3mf";
    tris = meshes.reduce((s, m) => s + m.mesh.tris.length / 3, 0);
    pieces = meshes.map((m) => m.mesh.pieces).join("+");
    closed = meshes.every((m) => m.mesh.closed);
  } else {
    // one solid: the parts fused together
    const whole = parts.length > 1 ? await unionBoxes(parts.flatMap((p) => p.boxes), parts[0].scale) : meshes[0].mesh;
    blob = o.format === "stl" ? stlBinary(whole) : objText([{ name: "tqr", mesh: whole }]);
    name = `${base}.${o.format}`;
    tris = whole.tris.length / 3;
    pieces = whole.pieces;
    closed = whole.closed;
  }
  saveBlob(blob, name);
  return (
    t("已下載 {f}：{t} 個三角形、{p} 件，約 {kb} KB。", { f: name, t: tris.toLocaleString(), p: pieces, kb: Math.round(blob.size / 1024) }) +
    " " +
    t(closed ? "網格水密。" : "注意：網格有未封閉的邊，切片前請先修復。")
  );
}
