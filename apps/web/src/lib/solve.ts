import TRI, { type Result, type Spec } from "@tqr/tri-core";
import type { Design } from "@/store";
import { qrMatrix, qrVersion } from "./qr";
import { encodeContent } from "./content";
import { imageToSide, sideLogoImage } from "./sideLogo";
import { centerLogoOverlay, logoErrorMessage } from "./centerLogo";
import { t } from "@/i18n";

export interface Prepared {
  spec: Spec;
  links: string[];
}

/** the text a view's content encodes */
export function payload(design: Design, i: number): string {
  const c = design.content[i];
  return encodeContent(c.type, c.fields);
}

/**
 * Build the solver spec from the design (on the main thread: logos are drawn with a canvas).
 * Throws with a user-facing message on bad input.
 */
export function prepare(design: Design): Prepared {
  const views = design.mode === "3qr" ? 3 : 2;
  const links = Array.from({ length: views }, (_, i) => payload(design, i));
  if (links.some((l) => !l)) throw new Error(t("請先填好每個方向的內容。"));
  let version: number;
  try {
    version = Math.max(...links.map((l) => qrVersion(l, design.level)));
  } catch {
    throw new Error(t("有連結太長，超過 QR 最高版本的容量。請改用短網址。"));
  }
  if (design.version && design.version < version) throw new Error(t("內容需要至少版本 {v}，請選更大的版本或改用自動。", { v: version }));
  if (design.version) version = design.version;
  const spec: Spec = {
    qr: links.map((l) => qrMatrix(l, version, design.level)),
    version,
    level: design.level,
    mode: design.mode,
    method: design.method,
    relaxed: design.relaxed && design.method.startsWith("bridge"),
    budget: design.budget / 100,
    logoBudget: design.sideLogo.budget / 100,
  };
  const n = 17 + 4 * version;
  if (design.mode === "2qr_logo") spec.logo = imageToSide(sideLogoImage(design.sideLogo, n), n);
  const L = design.centerLogo;
  if (L.kind !== "none") spec.overlays = spec.qr.map((_, i) => (L.views.includes(i) ? centerLogoOverlay(n, L, i) : null));
  return { spec, links };
}

/** the solver's error as a sentence */
export function solverError(msg: string): string {
  return logoErrorMessage(msg) ?? t("生成失敗：{e}", { e: msg.split("\n")[0] });
}

/** prepare and solve on this thread (tests and the worker-less fallback) */
export function solve(design: Design): { result: Result; links: string[] } {
  const { spec, links } = prepare(design);
  try {
    return { result: TRI.generate(spec), links };
  } catch (e) {
    throw new Error(solverError((e as Error).message));
  }
}

/**
 * Before any model exists, an "empty QR": only the version-1 function patterns (three finders and the timing lines)
 * in every view, carved as the three-view intersection, so every silhouette reads as a blank QR code.
 */
export function placeholder(): Result {
  const n = 21, F = new Uint8Array(n * n);
  const finder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) if (Math.max(Math.abs(r - 3), Math.abs(c - 3)) !== 2) F[(r0 + r) * n + c0 + c] = 1;
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i += 2) F[6 * n + i] = F[i * n + 6] = 1;
  const V = new Uint8Array(n * n * n);
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      if (F[x * n + y]) for (let z = 0; z < n; z++) if (F[x * n + z] && F[y * n + z]) V[(x * n + y) * n + z] = 1;
  let cubes = 0;
  for (const v of V) cubes += v;
  return { n, version: 1, V, E: [], bridgeMask: null, cubes, struts: 0, pieces: 1, mainShare: 1, onePiece: true,
           evals: [], kinds: ["qr", "qr", "qr"], info: {}, ms: 0 };
}
