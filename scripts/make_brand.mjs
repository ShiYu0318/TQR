// Brand assets from one geometry: the mark (an isometric cube with a QR finder pattern on each visible face, the solid
// corner where the three finders meet) and the module wordmark (T and R in QR modules, a finder pattern as the Q).
//
//   node scripts/make_brand.mjs
//
// Writes assets/brand/ (SVGs for the README and anywhere else, plus the GitHub social preview) and the web app's
// favicon and PWA icons in apps/web/public/. PNGs are rendered with Playwright's Chromium.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = join(ROOT, "assets", "brand");
const PUBLIC = join(ROOT, "apps", "web", "public");

const BLUE = { top: "#9ecbff", left: "#1f6feb", right: "#4493f8" }; // cube faces, lit from above
const ACCENT = "#4493f8"; // the Q
const NAVY = "#0d1117"; // finder patterns on the faces; also the app-icon ground
const INK = { onDark: "#e6edf3", onLight: "#0d1117" }; // T and R

const C = Math.sqrt(3) / 2;
const f2 = (v) => +v.toFixed(2);
const pts = (p) => p.map(([x, y]) => `${f2(x)},${f2(y)}`).join(" ");

// ---------- the mark, drawn in a 120×120 box (cube spans x 20.2-99.8, y 16-108)
function markBody() {
  const V = [60, 62], L = 46, [x, y] = V;
  const faces = {
    top: { poly: [[x, y], [x - C * L, y - L / 2], [x, y - L], [x + C * L, y - L / 2]], e: [[-C, -0.5], [C, -0.5]], fill: BLUE.top },
    left: { poly: [[x, y], [x - C * L, y - L / 2], [x - C * L, y + L / 2], [x, y + L]], e: [[-C, -0.5], [0, 1]], fill: BLUE.left },
    right: { poly: [[x, y], [x + C * L, y - L / 2], [x + C * L, y + L / 2], [x, y + L]], e: [[C, -0.5], [0, 1]], fill: BLUE.right },
  };
  const k = L / 9; // each face is a 9×9 module grid with the 7×7 finder one module in
  let out = "";
  for (const f of Object.values(faces)) {
    out += `<polygon points="${pts(f.poly)}" fill="${f.fill}"/>`;
    const m = `${f2(f.e[0][0] * k)} ${f2(f.e[0][1] * k)} ${f2(f.e[1][0] * k)} ${f2(f.e[1][1] * k)} ${x} ${y}`;
    out += `<g transform="matrix(${m})" fill="${NAVY}"><path fill-rule="evenodd" d="M1 1h7v7H1zM2 2v5h5V2z"/><rect x="3" y="3" width="3" height="3"/></g>`;
  }
  return out;
}

// ---------- the wordmark, in module units (19 × 9: caps are 7 modules, the Q's tail drops 2 below)
const T = ["11111", "00100", "00100", "00100", "00100", "00100", "00100"];
const R = ["11110", "10001", "10001", "11110", "10100", "10010", "10001"];
function glyphPath(rows, ox) {
  let d = "";
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; ) {
      if (row[c] !== "1") { c++; continue; }
      let e = c;
      while (row[e + 1] === "1") e++;
      d += `M${ox + c} ${r}h${e - c + 1}v1h-${e - c + 1}z`;
      c = e + 1;
    }
  });
  return d;
}
function wordmarkBody(ink) {
  return (
    `<path fill="${ink}" d="${glyphPath(T, 0)}${glyphPath(R, 14)}"/>` +
    `<path fill="${ACCENT}" fill-rule="evenodd" d="M6 0h7v7H6zM7 1v5h5V1z"/>` +
    `<path fill="${ACCENT}" d="M8 2h3v3H8zM12 7h1v1h-1zM13 8h1v1h-1z"/>`
  );
}

const svg = (viewBox, body, title, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img"${extra}><title>${title}</title>${body}</svg>\n`;

const markSvg = svg("12 14 96 96", markBody(), "TQR");
const wordmarkSvg = (ink) => svg("0 0 19 9", wordmarkBody(ink), "TQR", ' shape-rendering="crispEdges"');
// lockup: wordmark caps are 0.42 × the cube's height, centred on the cube's middle
function lockupSvg(ink) {
  const m = (0.42 * 92) / 7, x0 = 99.84 + 18, y0 = 62 - (7 * m) / 2;
  const word = `<g transform="translate(${f2(x0)} ${f2(y0)}) scale(${f2(m)})" shape-rendering="crispEdges">${wordmarkBody(ink)}</g>`;
  const w = x0 + 19 * m + 6 - 14;
  return svg(`14 12 ${f2(w)} 100`, markBody() + word, "TQR");
}

mkdirSync(BRAND, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
const files = {
  [join(BRAND, "logo.svg")]: markSvg,
  [join(BRAND, "wordmark-on-dark.svg")]: wordmarkSvg(INK.onDark),
  [join(BRAND, "wordmark-on-light.svg")]: wordmarkSvg(INK.onLight),
  [join(BRAND, "lockup-on-dark.svg")]: lockupSvg(INK.onDark),
  [join(BRAND, "lockup-on-light.svg")]: lockupSvg(INK.onLight),
  [join(PUBLIC, "icon.svg")]: markSvg,
};
for (const [path, text] of Object.entries(files)) writeFileSync(path, text);

// ---------- PNGs
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(html, width, height, out) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>${html}</body></html>`, { waitUntil: "networkidle" });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
}
// app icons: the cube on the studio's dark ground, inside the maskable safe zone (the central 80 % circle)
const icon = (size) =>
  `<div style="width:${size}px;height:${size}px;background:${NAVY};display:grid;place-items:center">` +
  markSvg.replace("<svg ", `<svg width="${Math.round(size * 0.66)}" height="${Math.round(size * 0.66)}" `) + "</div>";
for (const [size, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) await png(icon(size), size, size, join(PUBLIC, name));

// GitHub social preview (1280×640): upload it under Settings → General → Social preview
const social = `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@500;600&family=Noto+Sans+TC:wght@500&display=swap">
<div style="width:1280px;height:640px;box-sizing:border-box;padding:88px 96px;background:${NAVY};color:#e6edf3;display:flex;flex-direction:column;justify-content:space-between;font-family:'IBM Plex Sans','Noto Sans TC',sans-serif">
  <div style="width:560px">${lockupSvg(INK.onDark).replace("<svg ", '<svg width="560" ')}</div>
  <div style="display:flex;flex-direction:column;gap:14px">
    <div style="font-size:46px;font-weight:600;letter-spacing:-0.01em;line-height:1.15">One 3D-printed object.<br>A different QR code from every direction.</div>
    <div style="font-size:26px;color:#8b949e;font-family:'Noto Sans TC','IBM Plex Sans',sans-serif">從不同方向掃，讀到不同的連結。</div>
  </div>
  <div style="font:500 20px 'IBM Plex Mono',monospace;color:#8b949e;letter-spacing:0.04em">github.com/ShiYu0318/TQR</div>
</div>`;
await png(social, 1280, 640, join(BRAND, "social-preview.png"));
await browser.close();

console.log("brand assets written:", Object.keys(files).length + 4, "files");
