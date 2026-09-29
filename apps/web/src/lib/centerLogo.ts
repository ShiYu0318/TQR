// A logo in the middle of each QR view. The logo is drawn in the QR's own module grid (row = first view
// coordinate), so it reads upright like the code. The solver counts the codewords it changes against the error
// correction first and bridges only with what is left, so the views stay certified.
import { t } from "@/i18n";

export type CenterKind = "none" | "text" | "image";
export type CenterStyle = "box" | "bar" | "outline" | "clear";

export interface CenterLogo {
  kind: CenterKind;
  text: string;
  font: keyof typeof LOGO_FONTS;
  style: CenterStyle;
  /** box size in modules */
  size: number;
  /** light margin inside the box, in modules */
  margin: number;
  /** offset on screen, in modules (right, down) */
  dx: number;
  dy: number;
  /** QR views that carry it: 0 top, 1 front, 2 side */
  views: number[];
  /** an uploaded image, already reduced to a square 0/1 grid (small enough for a share link) */
  image: { size: number; bits: number[] } | null;
}

export const LOGO_FONTS = {
  sans: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
  jhenghei: '"Microsoft JhengHei", "Noto Sans TC", sans-serif',
  pingfang: '"PingFang TC", "Noto Sans TC", sans-serif',
  kai: '"BiauKai", "DFKai-SB", "Kaiti TC", "KaiTi", serif',
  serif: '"Noto Serif TC", "PMingLiU", serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
};

/** S×S RGBA → size×size dark mask (cell average below mid-grey) */
function downsample(data: Uint8ClampedArray, S: number, size: number) {
  const k = S / size, out = new Uint8Array(size * size);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      let s = 0, m = 0;
      for (let y = Math.floor(r * k); y < Math.floor((r + 1) * k); y++)
        for (let x = Math.floor(c * k); x < Math.floor((c + 1) * k); x++) {
          const i = (y * S + x) * 4;
          s += data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
          m++;
        }
      out[r * size + c] = s / m < 128 ? 1 : 0;
    }
  return out;
}

function rasterText(text: string, size: number, font: string) {
  const S = size * 12, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, S, S);
  g.fillStyle = "#000";
  const txt = (text || "QR").slice(0, 6);
  let fs = S * 0.95;
  g.font = `800 ${fs}px ${font}`;
  const w = g.measureText(txt).width;
  if (w > S * 0.95) fs *= (S * 0.95) / w;
  g.font = `800 ${fs}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(txt, S / 2, S / 2 + fs * 0.05);
  return downsample(g.getImageData(0, 0, S, S).data, S, size);
}

/** an uploaded picture fitted into a size×size dark mask */
export function bitsFromImage(img: CanvasImageSource & { width: number; height: number }, size: number) {
  const S = size * 12, cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, S, S);
  const sc = Math.min(S / img.width, S / img.height);
  g.drawImage(img, (S - img.width * sc) / 2, (S - img.height * sc) / 2, img.width * sc, img.height * sc);
  return downsample(g.getImageData(0, 0, S, S).data, S, size);
}

function resampleBits(bits: ArrayLike<number>, from: number, to: number) {
  const out = new Uint8Array(to * to);
  for (let r = 0; r < to; r++) for (let c = 0; c < to; c++) out[r * to + c] = bits[Math.floor((r * from) / to) * from + Math.floor((c * from) / to)];
  return out;
}

// Screen direction of the QR matrix axes in each preset view (top: row→left, col→down; front: row→left, col→up;
// side: row→right, col→up). A logo cell at screen (row tr, col tc) of an s×s box lands at matrix (r, c) below,
// and a screen offset (dx right, dy down) becomes a matrix offset, so the logo always reads upright.
const VIEW_MAP = [
  { cell: (tr: number, tc: number, s: number) => [s - 1 - tc, tr], shift: (dx: number, dy: number) => [-dx, dy] }, // top
  { cell: (tr: number, tc: number, s: number) => [s - 1 - tc, s - 1 - tr], shift: (dx: number, dy: number) => [-dx, -dy] }, // front
  { cell: (tr: number, tc: number, s: number) => [tc, s - 1 - tr], shift: (dx: number, dy: number) => [dx, -dy] }, // side
];

/**
 * The logo's region and target pixels (n*n each) on one QR view, or null for none.
 * `raster` draws text; it is injectable so the placement logic can be tested without a canvas.
 */
export function centerLogoOverlay(n: number, L: CenterLogo, view: number, raster = rasterText) {
  if (L.kind === "none") return null;
  const size = Math.max(3, Math.min(L.size, n - 14)), m = Math.min(L.margin, Math.floor((size - 1) / 2)), inner = size - 2 * m;
  let content: Uint8Array;
  if (L.kind === "image") {
    if (!L.image) return null;
    content = resampleBits(L.image.bits, L.image.size, inner);
  } else content = raster(L.text, inner, LOGO_FONTS[L.font] ?? LOGO_FONTS.sans);
  const local = new Uint8Array(size * size), dark = new Uint8Array(size * size); // region inside the size×size box
  for (let r = 0; r < inner; r++) for (let c = 0; c < inner; c++) dark[(r + m) * size + c + m] = content[r * inner + c];
  if (L.style === "box") local.fill(1);
  else if (L.style === "bar") {
    let r0 = size, r1 = -1;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (dark[r * size + c]) (r0 = Math.min(r0, r)), (r1 = Math.max(r1, r));
    for (let r = Math.max(0, r0 - m); r <= Math.min(size - 1, r1 + m); r++) for (let c = 0; c < size; c++) local[r * size + c] = 1;
  } else if (L.style === "outline") {
    const rad = Math.max(1, m);
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (dark[r * size + c])
          for (let a = -rad; a <= rad; a++)
            for (let b = -rad; b <= rad; b++) {
              const rr = r + a, cc = c + b;
              if (rr >= 0 && rr < size && cc >= 0 && cc < size) local[rr * size + cc] = 1;
            }
  } else for (let i = 0; i < size * size; i++) local[i] = dark[i]; // transparent: only the dark strokes
  const region = new Uint8Array(n * n), pixels = new Uint8Array(n * n);
  const map = VIEW_MAP[view || 0], [sr, sc] = map.shift(L.dx, L.dy);
  const r0 = Math.floor((n - size) / 2) + sr, c0 = Math.floor((n - size) / 2) + sc;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const [mr, mc] = map.cell(r, c, size), R = r0 + mr, C = c0 + mc;
      if (R < 0 || R >= n || C < 0 || C >= n || !local[r * size + c]) continue;
      region[R * n + C] = 1;
      pixels[R * n + C] = dark[r * size + c];
    }
  return { region, pixels };
}

const VIEW_NAMES = ["上方", "前方", "側面"];

/** the solver's "LOGO_TOO_LARGE:block:needed:capacity:view" as a sentence, or null for any other error */
export function logoErrorMessage(err: string): string | null {
  const m = /LOGO_TOO_LARGE:(\d+):(\d+):(\d+):(\d+)/.exec(err || "");
  if (!m) return null;
  return t("Logo 太大：{view}的第 {b} 區塊要改動 {x} 個碼字，但只能更正 {c} 個。請縮小 Logo、改用「字外框」或「透明底」，或加大 QR 版本。", { view: t(VIEW_NAMES[+m[4]]), b: +m[1] + 1, x: m[2], c: m[3] });
}
