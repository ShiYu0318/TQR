// The third view of "2 QR + logo": a pixel picture in the QR's module grid, drawn upright for the side camera.

export type LogoKind = "heart" | "star" | "ring" | "text";

export interface SideLogo {
  kind: LogoKind;
  text: string;
  /** white icon on a dark field: an all-white row would leave a whole QR row uncoverable */
  badge: boolean;
  /** share of logo pixels that may flip, in % */
  budget: number;
}

/** n*n picture, row-major, 1 = dark */
export function logoImage(kind: LogoKind, n: number, text: string): Uint8Array {
  const c = (n - 1) / 2, img = new Uint8Array(n * n);
  if (kind === "text") {
    const S = n * 8, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d", { willReadFrequently: true })!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, S, S);
    g.fillStyle = "#000";
    const t = (text || "QR").slice(0, 4);
    let fs = S * 0.9;
    const font = (px: number) => `800 ${px}px 'IBM Plex Sans', 'Noto Sans TC', sans-serif`;
    g.font = font(fs);
    const wmax = S * 0.9, w = g.measureText(t).width;
    if (w > wmax) fs *= wmax / w;
    g.font = font(fs);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(t, S / 2, S / 2 + fs * 0.04);
    const d = g.getImageData(0, 0, S, S).data;
    for (let r = 0; r < n; r++)
      for (let q = 0; q < n; q++) {
        let s = 0;
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) s += d[((r * 8 + yy) * S + q * 8 + xx) * 4];
        img[r * n + q] = s / 64 < 128 ? 1 : 0;
      }
    return img;
  }
  for (let r = 0; r < n; r++)
    for (let q = 0; q < n; q++) {
      const u = (q - c) / (n / 2), v = (c - r) / (n / 2);
      let val: boolean;
      if (kind === "heart") {
        const u2 = u * 1.25, v2 = v * 1.25 + 0.15;
        val = Math.pow(u2 * u2 + v2 * v2 - 1, 3) - u2 * u2 * v2 * v2 * v2 <= 0;
      } else if (kind === "star") {
        const a = Math.atan2(v, u), rr = 0.45 + 0.4 * Math.abs(Math.cos(2.5 * (a + Math.PI / 2)));
        val = Math.hypot(u, v) <= rr * 0.95;
      } else {
        const rad = Math.hypot(u, v);
        val = rad <= 0.9 && rad >= 0.55;
      }
      img[r * n + q] = val ? 1 : 0;
    }
  return img;
}

/** white icon on a dark field with a dark frame */
export function badgeOf(img: Uint8Array, n: number): Uint8Array {
  const m = Math.max(1, Math.floor(n / 12)), out = new Uint8Array(n * n);
  for (let r = 0; r < n; r++)
    for (let q = 0; q < n; q++) {
      const frame = r < m || r >= n - m || q < m || q >= n - m;
      out[r * n + q] = frame || !img[r * n + q] ? 1 : 0;
    }
  return out;
}

export function sideLogoImage(logo: SideLogo, n: number): Uint8Array {
  const img = logoImage(logo.kind, n, logo.text);
  return logo.badge ? badgeOf(img, n) : img;
}

/** the picture as the side view sees it: (y, z) indexing, rows running up the sculpture */
export function imageToSide(img: Uint8Array, n: number): Uint8Array {
  const T = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) T[y * n + z] = img[(n - 1 - z) * n + y];
  return T;
}
