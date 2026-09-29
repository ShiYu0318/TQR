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

/** n*n matrix, row-major, 1 = dark */
export function qrMatrix(text: string, version: number, level: Level): Uint8Array {
  const q = qrcode(version as TypeNumber, level);
  q.addData(text, "Byte");
  q.make();
  const n = q.getModuleCount(), M = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) M[r * n + c] = q.isDark(r, c) ? 1 : 0;
  return M;
}
