import qrcode from "qrcode-generator";

type TypeNumber = Parameters<typeof qrcode>[0];
import type { Level } from "@tqr/tri-core";

// One generator and one version rule, so the same text always gives the same matrix (and mask).

/** smallest QR version that holds the text at this level (throws when it does not fit version 40) */
export function qrVersion(text: string, level: Level): number {
  const q = qrcode(0, level);
  q.addData(text, "Byte");
  q.make();
  return (q.getModuleCount() - 17) / 4;
}

/**
 * An SVG QR code for a link: level M when it fits, else L; null when the text is too long for any QR code. Dark modules
 * on white with a two-module quiet zone, one path of horizontal runs.
 */
export function qrSvg(text: string): { svg: string; version: number; level: Level } | null {
  for (const level of ["M", "L"] as Level[]) {
    let version: number;
    try {
      version = qrVersion(text, level);
    } catch {
      continue;
    }
    const M = qrMatrix(text, version, level), n = 17 + 4 * version, q = 2, size = n + 2 * q;
    let d = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!M[r * n + c] || (c > 0 && M[r * n + c - 1])) continue;
        let e = c;
        while (e + 1 < n && M[r * n + e + 1]) e++;
        d += `M${c + q} ${r + q}h${e - c + 1}v1h-${e - c + 1}z`;
      }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
    return { svg, version, level };
  }
  return null;
}

/** n*n matrix, row-major, 1 = dark */
export function qrMatrix(text: string, version: number, level: Level): Uint8Array {
  const q = qrcode(version as TypeNumber, level);
  q.addData(text, "Byte");
  q.make();
  const n = q.getModuleCount(), M = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) M[r * n + c] = q.isDark(r, c) ? 1 : 0;
  return M;
}
