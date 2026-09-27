/** WCAG relative luminance of a #rrggbb colour */
export function luminance(hex: string): number {
  const v = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export interface ContrastVerdict {
  ratio: number;
  tone: "ok" | "warn" | "bad";
  message: string;
}

/** Whether the tile's two filaments read as a QR: dark must be darker, and the contrast at least 3:1. */
export function filamentContrast(dark: string, light: string): ContrastVerdict {
  const ld = luminance(dark), ll = luminance(light);
  const ratio = (Math.max(ld, ll) + 0.05) / (Math.min(ld, ll) + 0.05), r = ratio.toFixed(1);
  if (ld > ll) return { ratio, tone: "bad", message: "深淺顛倒：深色線材比淺色亮，多數掃描器讀不到反相的 QR。" };
  if (ratio < 3) return { ratio, tone: "warn", message: `對比 ${r}:1，偏低，掃描器可能讀不到。` };
  return { ratio, tone: "ok", message: `對比 ${r}:1，足夠。` };
}
