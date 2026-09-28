// 2D export (F10) with a quiet-zone border (F4). The silhouette QR of one view is the module image the certificate
// checks, drawn as it appears on screen (top: row→left, col→down; front: row→left, col→up; side: row→right, col→up).
import type { Result } from "@tqr/tri-core";

export function silhouetteImage(r: Pick<Result, "n" | "V">, view: number): { n: number; S: Uint8Array } {
  const n = r.n, n2 = n * n, P = new Uint8Array(n2);
  for (let c = 0; c < r.V.length; c++) {
    if (!r.V[c]) continue;
    const z = c % n, y = ((c / n) | 0) % n, x = (c / n2) | 0;
    P[view === 0 ? x * n + y : view === 1 ? x * n + z : y * n + z] = 1;
  }
  const S = new Uint8Array(n2); // screen orientation
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      if (!P[a * n + b]) continue;
      const [sx, sy] = view === 0 ? [n - 1 - a, b] : view === 1 ? [n - 1 - a, n - 1 - b] : [a, n - 1 - b];
      S[sy * n + sx] = 1;
    }
  return { n, S };
}

/** black modules on white with `border` light modules around, one rect per horizontal run */
export function silhouetteSvg(n: number, S: Uint8Array, border: number): string {
  const N = n + 2 * border, rects: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!S[y * n + x]) {
        x++;
        continue;
      }
      let x1 = x;
      while (x1 + 1 < n && S[y * n + x1 + 1]) x1++;
      rects.push(`<rect x="${x + border}" y="${y + border}" width="${x1 - x + 1}" height="1"/>`);
      x = x1 + 1;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${N * 10}" height="${N * 10}" shape-rendering="crispEdges">` +
    `<rect width="${N}" height="${N}" fill="#fff"/><g fill="#000">${rects.join("")}</g></svg>`
  );
}

/** the same image as a PNG at 16 px per module */
export function silhouettePng(n: number, S: Uint8Array, border: number): Promise<Blob> {
  const px = 16, N = n + 2 * border, cv = document.createElement("canvas");
  cv.width = cv.height = N * px;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#000";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (S[y * n + x]) g.fillRect((x + border) * px, (y + border) * px, px, px);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}
