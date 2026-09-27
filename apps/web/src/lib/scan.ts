import * as Comlink from "comlink";
import type { ScanApi } from "@/workers/scan.worker";
import { useStudio } from "@/store";
import { captureScan } from "@/three/Scanner";
import { live } from "@/three/live";
import { TILE } from "./tile";

let worker: Comlink.Remote<ScanApi> | null = null;
let timer = 0;

function scanWorker() {
  worker ??= Comlink.wrap<ScanApi>(new Worker(new URL("../workers/scan.worker.ts", import.meta.url), { type: "module" }));
  return worker;
}

/** why nothing of this model decodes here, in words */
function reason(): string {
  const s = useStudio.getState();
  if (s.model !== "sil") return "換個角度或距離試試";
  if (s.camera.distanceCm < 250) return "剪影需要把相機拉遠，試試數公尺外";
  const mode = s.generatedWith?.mode;
  if (mode && mode !== "3qr" && Math.abs(live.azimuth - 90) < 20 && Math.abs(live.elevation) < 20)
    return mode === "2qr_wall" ? "這一面是牆，不是 QR" : "這一面是 Logo，不是 QR";
  return "換個角度或距離試試";
}

let running: Promise<unknown> = Promise.resolve();

/** read the current view and record what it decodes to */
export async function scanNow(quick = false): Promise<string | null> {
  // one scan at a time; a scan asked for meanwhile waits, then reads the view as it is now
  const turn = running.then(() => scanOnce(quick));
  running = turn.catch(() => null);
  return turn;
}

async function scanOnce(quick: boolean): Promise<string | null> {
  if (!captureScan) return null;
  const image = captureScan();
  const text = await scanWorker().scan(Comlink.transfer(image, [image.data.buffer]), quick);
  const s = useStudio.getState();
  const links: Record<string, string | undefined> = s.model === "sil" ? { top: s.links[0], front: s.links[1], side: s.links[2] } : TILE.links;
  const key = text ? (Object.keys(links).find((k) => links[k] === text) ?? null) : null;
  s.setScan({ ready: true, text, key, reason: text ? (key ? "" : "不是這個模型的連結") : reason() });
  return text;
}

/** scan after `ms`; with `throttle` an already pending scan is kept (used while spinning) */
export function scheduleScan(ms: number, throttle = false) {
  if (throttle && timer) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = 0;
    void scanNow(throttle);
  }, ms);
}
