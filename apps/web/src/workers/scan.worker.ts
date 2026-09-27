// Reads QR codes from rendered frames with zxing-cpp (WebAssembly), off the main thread.
// The .wasm file is bundled and served by the site itself (no CDN), so scanning also works offline.
//
// A rendered silhouette is not a clean print: hairline gaps between cubes and thin struts cross the modules, and
// zxing-cpp's binarizer trips on them. Shrinking the frame and blurring it a little first (as a phone camera's
// optics would) makes those details vanish while the modules stay; a few scale × blur tries cover near and far views.
import * as Comlink from "comlink";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
  fireImmediately: true,
});

/** scale, blur radius (px); the first is the one that reads most frames and is all a quick scan tries */
const TRIES: [number, number][] = [[0.5, 2], [0.75, 2], [0.35, 2], [1, 0]];

/** luminance, area-averaged down to scale */
function grey(img: ImageData, scale: number) {
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const out = new Float32Array(w * h), d = img.data, kx = img.width / w, ky = img.height / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let yy = Math.floor(y * ky); yy < Math.floor((y + 1) * ky) || yy === Math.floor(y * ky); yy++)
        for (let xx = Math.floor(x * kx); xx < Math.floor((x + 1) * kx) || xx === Math.floor(x * kx); xx++) {
          const i = (yy * img.width + xx) * 4;
          s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          n++;
        }
      out[y * w + x] = s / n;
    }
  return { w, h, px: out };
}

/** three box blurs ≈ a Gaussian of the given radius */
function blur(g: { w: number; h: number; px: Float32Array }, r: number) {
  if (!r) return g;
  const { w, h } = g;
  let a = g.px, b = new Float32Array(w * h);
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      const at = (i: number) => (horizontal ? l * w + i : i * w + l);
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[at(Math.min(len - 1, Math.max(0, i)))];
      for (let i = 0; i < len; i++) {
        dst[at(i)] = acc / (2 * r + 1);
        acc += src[at(Math.min(len - 1, i + r + 1))] - src[at(Math.max(0, i - r))];
      }
    }
  };
  for (let k = 0; k < 3; k++) {
    pass(a, b, true);
    pass(b, a, false);
  }
  return { w, h, px: a };
}

function toImageData(g: { w: number; h: number; px: Float32Array }) {
  const out = new Uint8ClampedArray(g.w * g.h * 4);
  for (let i = 0; i < g.px.length; i++) out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g.px[i], (out[i * 4 + 3] = 255);
  return new ImageData(out, g.w, g.h);
}

const api = {
  /** the first QR text in the frame, or null; `quick` (while spinning) tries only the most productive preparation */
  async scan(image: ImageData, quick: boolean): Promise<string | null> {
    for (const [scale, r] of quick ? TRIES.slice(0, 1) : TRIES) {
      const found = await readBarcodes(toImageData(blur(grey(image, scale), r)), {
        formats: ["QRCode"], tryHarder: true, tryInvert: false, maxNumberOfSymbols: 1,
      });
      const hit = found.find((x) => x.isValid);
      if (hit) return hit.text;
    }
    return null;
  },
};

export type ScanApi = typeof api;
Comlink.expose(api);
