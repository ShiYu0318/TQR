import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useStudio, type Model } from "@/store";
import { VIEW_TOL, dirOf, live, subscribeLive } from "@/three/live";
import { t } from "@/i18n";

const S = 88, C = S / 2, R = 30;
const LETTER: Record<string, string> = { 上: "U", 下: "D", 前: "F", 後: "B", 左: "L", 右: "R", 北: "N", 南: "S", 東: "E", 西: "W" };

interface End {
  axis: [number, number, number];
  label: string;
  colour: string;
  azimuth: number;
  elevation: number;
  /** filled = a readable view; hollow = the mirror side (or the tile's underside) */
  solid: boolean;
}

// colours follow the model's axes as in Blender: x (left/right) red, y (front/back) green, z (up/down) blue
function ends(model: Model): End[] {
  const sil = model === "sil", el = sil ? 0 : 40;
  return [
    { axis: [0, 1, 0], label: "上", colour: "#58a6ff", azimuth: 0, elevation: 90, solid: true },
    { axis: [0, -1, 0], label: "下", colour: "#58a6ff", azimuth: 0, elevation: -90, solid: false },
    { axis: [0, 0, -1], label: sil ? "前" : "北", colour: "#3fb950", azimuth: 0, elevation: el, solid: true },
    { axis: [0, 0, 1], label: sil ? "後" : "南", colour: "#3fb950", azimuth: 180, elevation: el, solid: !sil },
    { axis: [1, 0, 0], label: sil ? "左" : "東", colour: "#f85149", azimuth: 90, elevation: el, solid: true },
    { axis: [-1, 0, 0], label: sil ? "右" : "西", colour: "#f85149", azimuth: 270, elevation: el, solid: !sil },
  ];
}

interface Drawn extends End {
  sx: number;
  sy: number;
  z: number;
  usable: boolean;
}

/** Three-axis orientation gizmo: axis ends lit when the camera faces them, click one to look from that side. */
export function Gizmo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hover = useRef<string | null>(null);
  const hits = useRef<Drawn[]>([]);
  const key = useRef("");
  const model = useStudio((s) => s.model);
  const lang = useStudio((s) => s.lang);

  useEffect(() => {
    const cv = canvas.current!, g = cv.getContext("2d")!;
    const inv = new THREE.Quaternion(), v = new THREE.Vector3(), d = new THREE.Vector3();
    const draw = (force = false) => {
      const q = live.quaternion, k = [q.x, q.y, q.z, q.w].map((x) => x.toFixed(3)).join() + model + lang + hover.current;
      if (k === key.current && !force) return;
      key.current = k;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (cv.width !== S * dpr) cv.width = cv.height = S * dpr;
      inv.copy(q).invert();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, S);
      if (hover.current !== null) {
        g.fillStyle = "rgba(255,255,255,.08)"; // Blender-style hover disc
        g.beginPath();
        g.arc(C, C, 43, 0, 2 * Math.PI);
        g.fill();
      }
      g.strokeStyle = "#30363d"; // gimbal ring
      g.lineWidth = 1;
      g.beginPath();
      g.arc(C, C, 41, 0, 2 * Math.PI);
      g.stroke();
      g.setLineDash([2, 3]); // horizon ring, seen from the camera
      g.strokeStyle = "#8b949e";
      g.globalAlpha = 0.55;
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * 2 * Math.PI;
        v.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(inv);
        if (i) g.lineTo(C + v.x * R, C - v.y * R);
        else g.moveTo(C + v.x * R, C - v.y * R);
      }
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      const drawn: Drawn[] = ends(model)
        .map((e) => {
          v.set(...e.axis).applyQuaternion(inv);
          return { ...e, sx: C + v.x * R, sy: C - v.y * R, z: v.z, usable: !(model === "tile" && e.axis[1] < 0) };
        })
        .sort((a, b) => a.z - b.z); // far ends first
      g.font = "600 10px " + getComputedStyle(document.body).fontFamily;
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const e of drawn) {
        const lit = dirOf(e.azimuth, e.elevation, d).dot(live.dir) > VIEW_TOL;
        g.globalAlpha = 0.45 + (0.55 * (e.z + 1)) / 2;
        if (e.solid) {
          g.strokeStyle = e.colour;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(C, C);
          g.lineTo(e.sx, e.sy);
          g.stroke();
        }
        if (lit) {
          g.globalAlpha = 1;
          g.fillStyle = e.colour;
          g.shadowColor = e.colour;
          g.shadowBlur = 10;
          g.beginPath();
          g.arc(e.sx, e.sy, 9.5, 0, 2 * Math.PI);
          g.fill();
          g.shadowBlur = 0;
        }
        const hot = hover.current === e.label && e.usable;
        if (hot) {
          g.globalAlpha = 1; // hovered end: white rim
          g.fillStyle = "#ffffff";
          g.beginPath();
          g.arc(e.sx, e.sy, 10.5, 0, 2 * Math.PI);
          g.fill();
        }
        g.beginPath();
        g.arc(e.sx, e.sy, hot ? 9 : 8, 0, 2 * Math.PI);
        if (e.solid) {
          g.fillStyle = e.colour;
          g.fill();
          g.fillStyle = "#0d1117";
        } else {
          g.fillStyle = "#0d1117";
          g.fill();
          g.strokeStyle = e.colour;
          g.lineWidth = 1.5;
          g.stroke();
          g.fillStyle = e.colour;
        }
        if (!e.usable) g.globalAlpha = 0.35;
        g.fillText(lang === "en" ? LETTER[e.label] : e.label, e.sx, e.sy + 0.5);
      }
      g.globalAlpha = 1;
      hits.current = drawn.filter((e) => e.usable).reverse(); // nearest first
    };
    const hit = (ev: PointerEvent | MouseEvent) => {
      const r = cv.getBoundingClientRect(), x = ((ev.clientX - r.left) * S) / r.width, y = ((ev.clientY - r.top) * S) / r.height;
      return hits.current.find((e) => Math.hypot(e.sx - x, e.sy - y) <= 11) ?? null;
    };
    const onMove = (ev: PointerEvent) => {
      const h = hit(ev), label = h ? h.label : "";
      cv.style.cursor = h ? "pointer" : "default";
      if (label !== hover.current) {
        hover.current = label;
        draw(true);
      }
    };
    const onLeave = () => {
      hover.current = null;
      draw(true);
    };
    const onClick = (ev: MouseEvent) => {
      const h = hit(ev);
      if (!h) return;
      const s = useStudio.getState();
      s.setCamera({ spin: null });
      s.requestView(h.azimuth, h.elevation, model === "sil" ? Math.max(s.camera.distanceCm, 250) : s.camera.distanceCm);
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("click", onClick);
    draw(true);
    const off = subscribeLive(() => draw());
    return () => {
      off();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("click", onClick);
    };
  }, [model, lang]);

  return (
    <canvas
      ref={canvas}
      width={S}
      height={S}
      role="img"
      aria-label={t("三軸方向儀：點一個軸的端點切換到那個方向")}
      title={t("點一個軸的端點切換到那個方向")}
      className="size-22 self-center touch-none"
    />
  );
}
