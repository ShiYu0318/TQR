import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useStudio, type Model } from "@/store";
import { TILE } from "@/lib/tile";
import { VIEW_TOL, dirOf, live, subscribeLive } from "@/three/live";
import { overlay } from "./RightColumn";
import { useT } from "@/i18n";

/** a view button: label, azimuth, elevation, and the link it faces */
type View = [label: string, azimuth: number, elevation: number, key: string];

// TQR: one row per axis, the view on the left and its mirror side on the right
const SIL_PAD: View[][] = [
  [["上", 0, 90, "top"], ["下", 0, -90, "top"]],
  [["前", 0, 0, "front"], ["後", 180, 0, "front"]],
  [["左", 90, 0, "side"], ["右", 270, 0, "side"]],
];
// QQR: a cross, the top view in the middle and the four sides read 40° from above
const TILE_PAD: (View | null)[] = [
  null, ["北", 0, 40, "N"], null,
  ["西", 270, 40, "W"], ["上", 0, 90, "T"], ["東", 90, 40, "E"],
  null, ["南", 180, 40, "S"], null,
];
const LINK_ROWS: Record<Model, string[][]> = { sil: [["top"], ["front"], ["side"]], tile: [["T"], ["N", "S"], ["W", "E"]] };
const VIEW_OF: Record<string, [number, number]> = {
  top: [0, 90], front: [0, 0], side: [90, 0], T: [0, 90], N: [0, 40], S: [180, 40], W: [270, 40], E: [90, 40],
};
const DIR_NAME: Record<string, string> = {
  top: "上／下", front: "前／後", side: "左／右", T: "俯視（正上方）", N: "北面", E: "東面", S: "南面", W: "西面",
};

const icon = { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", "aria-hidden": true } as const;
const SPINS: { mode: "v" | "h" | "free"; label: string; title: string; icon: ReactNode }[] = [
  { mode: "v", label: "垂直旋轉", title: "不停地垂直繞圈（經過上方與下方）；再按一次或拖曳畫面就停",
    icon: <svg {...icon}><ellipse cx="8" cy="8" rx="3.2" ry="6.3" /><path d="M11.2 6.2 11.2 8.6 13.4 7.4" /></svg> },
  { mode: "h", label: "水平旋轉", title: "不停地水平繞圈；再按一次或拖曳畫面就停",
    icon: <svg {...icon}><ellipse cx="8" cy="8" rx="6.3" ry="3.2" /><path d="M6.2 11.2 8.6 11.2 7.4 13.4" /></svg> },
  { mode: "free", label: "360° 旋轉", title: "不停地翻轉、看遍六個面；再按一次或拖曳畫面就停",
    icon: <svg {...icon}><circle cx="8" cy="8" r="6.3" /><ellipse cx="8" cy="8" rx="6.3" ry="2.4" /><ellipse cx="8" cy="8" rx="2.4" ry="6.3" /></svg> },
];

/** which view buttons face the camera (within 8°), recomputed each frame but re-rendered only on change */
function useLitViews(views: View[]) {
  const [lit, setLit] = useState<string>("");
  const d = useRef(new THREE.Vector3());
  useEffect(() => {
    let last = "";
    const check = () => {
      const on = views.map((v, i) => (dirOf(v[1], v[2], d.current).dot(live.dir) > VIEW_TOL ? i : -1)).filter((i) => i >= 0).join();
      if (on === last) return;
      last = on;
      setLit(on);
    };
    check();
    return subscribeLive(check);
  }, [views]);
  return new Set(lit ? lit.split(",").map(Number) : []);
}

const padButton = "border-0 bg-transparent px-2 py-0.5 text-xs leading-4.25 text-muted transition-[background,color,box-shadow] duration-150 hover:text-ink aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-ink aria-pressed:shadow-[0_0_10px_rgba(56,139,253,.55)]";
const head = "font-mono text-[9.5px] leading-none tracking-wider text-muted text-center uppercase";

export function ControlBar() {
  const t = useT();
  const model = useStudio((s) => s.model);
  const spin = useStudio((s) => s.camera.spin);
  const setCamera = useStudio((s) => s.setCamera);
  const requestView = useStudio((s) => s.requestView);
  const links = useStudio((s) => s.links);
  const mode = useStudio((s) => s.design.mode);
  const result = useStudio((s) => s.result);
  const found = useStudio((s) => s.found[model]);
  const markFound = useStudio((s) => s.markFound);
  const clean = useStudio((s) => s.clean);
  const bar = useRef<HTMLDivElement>(null);

  const views = model === "sil" ? SIL_PAD.flat() : (TILE_PAD.filter(Boolean) as View[]);
  const lit = useLitViews(views);
  const litKeys = new Set([...lit].map((i) => views[i][3]));

  const linkOf = (k: string): string | null => {
    if (model === "tile") return TILE.links[k as keyof typeof TILE.links];
    const i = ["top", "front", "side"].indexOf(k);
    return result ? (links[i] ?? null) : null;
  };
  // a link that has lit once keeps its outline until the view is reset or a new model is generated
  useEffect(() => litKeys.forEach((k) => linkOf(k) && markFound(model, k)));

  // the right column ends just above this bar
  useEffect(() => {
    const el = bar.current!, stage = el.closest<HTMLElement>("#stage")!;
    const ro = new ResizeObserver(() => stage.style.setProperty("--barh", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = ([, az, el]: View) => {
    const s = useStudio.getState();
    setCamera({ spin: null });
    requestView(az, el, model === "sil" ? Math.max(s.camera.distanceCm, 250) : s.camera.distanceCm);
  };
  const viewButton = (v: View, i: number) => (
    <button key={v[0]} type="button" aria-pressed={lit.has(i)} onClick={() => go(v)} className={padButton}>
      {t(v[0])}
    </button>
  );

  return (
    <div
      ref={bar}
      role="group"
      aria-label={t("快速視角與相機距離")}
      className={`${overlay} absolute right-2 bottom-2 left-2 z-2 flex items-stretch gap-2.5 px-2.5 py-1.5 transition-[opacity,visibility] duration-200 max-[900px]:static ${clean ? "pointer-events-none invisible opacity-0" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <div className="grid gap-0.75" role="group" aria-label={t("自動旋轉")}>
          <div className={head}>{t("自動旋轉")}</div>
          {SPINS.map((s) => (
            <button
              key={s.mode}
              type="button"
              title={t(s.title)}
              aria-pressed={spin === s.mode}
              onClick={() => setCamera({ spin: spin === s.mode ? null : s.mode })}
              className="flex items-center gap-1.5 rounded-md border border-rule bg-sunk px-2 py-0.5 text-xs leading-4.25 whitespace-nowrap text-muted hover:text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-ink"
            >
              {s.icon}
              <span>{t(s.label)}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-0.75" id="presets">
          {model === "sil" ? (
            <>
              <div className={`${head} grid grid-cols-2`}>
                <span>{t("正像")}</span>
                <span>{t("鏡像")}</span>
              </div>
              {SIL_PAD.map((row, r) => (
                <div key={r} role="group" className="grid grid-cols-2 overflow-hidden rounded-md border border-rule bg-sunk [&>button+button]:border-l [&>button+button]:border-rule">
                  {row.map((v, c) => viewButton(v, r * 2 + c))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className={head}>{t("方向")}</div>
              <div role="group" className="grid grid-cols-[repeat(3,2.4em)] gap-0.75">
                {TILE_PAD.map((v, i) => {
                  if (!v) return <span key={i} />;
                  const idx = views.indexOf(v);
                  return (
                    <button
                      key={v[0]}
                      type="button"
                      aria-pressed={lit.has(idx)}
                      onClick={() => go(v)}
                      className={`${padButton} rounded-md border border-rule bg-sunk! aria-pressed:bg-accent! ${i === 4 ? "rounded-[50%/40%]" : ""}`}
                    >
                      {t(v[0])}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-0.75" role="group" aria-label={t("連結")}>
          <div className={head}>{t("連結")}</div>
          {LINK_ROWS[model].map((keys, r) => (
            <div key={r} className="flex min-w-0 gap-0.75">
              {keys.map((k) => {
                const url = linkOf(k);
                const other = model === "sil" && result && mode !== "3qr" ? (mode === "2qr_wall" ? t("牆") : "Logo") : "-";
                const text = !url ? other : keys.length > 1 ? url.replace(/^https?:\/\/[^/]+\/?/, "") || url.replace(/^https?:\/\//, "") : url.replace(/^https?:\/\//, "");
                const now = litKeys.has(k) && !!url, seen = found.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!url}
                    title={url ? t("{d}：{u}", { d: t(DIR_NAME[k]), u: url }) : undefined}
                    onClick={() => url && go([k, ...VIEW_OF[k], k] as View)}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-0.5 text-left text-[11.5px] leading-4.25 transition-[background,color,box-shadow] duration-150 disabled:cursor-default disabled:opacity-65 ${
                      now
                        ? "border-accent bg-accent text-accent-ink shadow-[0_0_10px_rgba(56,139,253,.55)]"
                        : seen
                          ? "border-accent bg-sunk text-accent"
                          : "border-rule bg-sunk text-muted hover:enabled:text-ink"
                    }`}
                  >
                    <i className={`size-1.75 flex-none rounded-full ${now ? "bg-accent-ink" : seen ? "bg-accent" : "bg-rule"}`} />
                    <span className="truncate font-mono">{text}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
