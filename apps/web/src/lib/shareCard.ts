// A 1200 x 630 picture to post with a share link: the view on the left; the logo, what each direction opens and the
// link as a QR code on the right.
import lockup from "../../../../assets/brand/lockup-on-dark.svg";
import { useStudio } from "@/store";
import { t } from "@/i18n";
import { captureView } from "@/three/Scanner";
import { encodeContent, payloadPreview } from "./content";
import { qrSvg } from "./qr";
import { TILE } from "./tile";

const W = 1200, H = 630, INK = "#e6edf3", MUTED = "#8b949e", BG = "#0d1117", PANEL = "#161b22", ACCENT = "#4493f8";

function picture(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** what each direction of the model on screen opens */
export function cardLines(): [string, string][] {
  const s = useStudio.getState();
  if (s.model === "tile") return (["T", "N", "E", "S", "W"] as const).map((k, i) => [t(["俯視", "北面", "東面", "南面", "西面"][i]), TILE.links[k]]);
  const views = s.design.mode === "3qr" ? 3 : 2;
  return s.design.content.slice(0, views).map((c, i) => [t(["上方", "前方", "側面"][i]), payloadPreview(encodeContent(c.type, c.fields))]);
}

function fit(g: CanvasRenderingContext2D, text: string, width: number): string {
  if (g.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + "...").width > width) s = s.slice(0, -1);
  return s + "...";
}

export async function shareCard(link: string): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  await document.fonts?.ready;
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);

  // the view, cropped to a square on the left
  if (captureView) {
    const view = await createImageBitmap(await captureView()), side = Math.min(view.width, view.height);
    g.drawImage(view, (view.width - side) / 2, (view.height - side) / 2, side, side, 0, 0, H, H);
  }
  g.fillStyle = PANEL;
  g.fillRect(H, 0, W - H, H);

  const x = H + 48, width = W - x - 48;
  const logo = await picture(lockup);
  g.drawImage(logo, x, 44, 190, (190 * logo.height) / logo.width);

  g.textBaseline = "top";
  g.fillStyle = INK;
  g.font = "600 30px 'IBM Plex Sans', 'Noto Sans TC', sans-serif";
  g.fillText(fit(g, t("多視角 QR 設計"), width), x, 150);
  let y = 204;
  for (const [name, text] of cardLines()) {
    g.fillStyle = ACCENT;
    g.font = "600 20px 'IBM Plex Sans', 'Noto Sans TC', sans-serif";
    g.fillText(name, x, y);
    g.fillStyle = MUTED;
    g.font = "400 20px 'IBM Plex Mono', 'Noto Sans TC', monospace";
    g.fillText(fit(g, text, width - 72), x + 72, y);
    y += 34;
  }

  const qr = qrSvg(link);
  if (qr) {
    // as large as the space under the text allows, a whole number of pixels per module so the edges stay sharp
    const modules = 17 + 4 * qr.version + 4, room = Math.min(250, H - 40 - (y + 16));
    const size = Math.floor(room / modules) * modules, qy = H - 40 - size;
    g.imageSmoothingEnabled = false;
    g.drawImage(await picture("data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr.svg)), x, qy, size, size);
    g.fillStyle = MUTED;
    g.font = "400 18px 'IBM Plex Sans', 'Noto Sans TC', sans-serif";
    g.fillText(fit(g, t("掃描打開這個設計"), width - size - 24), x + size + 24, qy + size - 24);
  }
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
