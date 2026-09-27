import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/store";
import { Stage } from "@/three/Stage";
import { cmToSlider, sliderToCm } from "@/three/live";
import { RightColumn } from "./RightColumn";
import { ControlBar } from "./ControlBar";
import { Hint } from "./Hint";
import { live, subscribeLive } from "@/three/live";
import { scheduleScan } from "@/lib/scan";

/**
 * The 3D view with its overlays. Owns three behaviours of the stage as a whole:
 * full screen (the Fullscreen API, or filling the window where a sandbox blocks it), the clean view (every control
 * hidden; the eye shows only while the pointer moves, for up to 2 s at rest), and zoom (wheel, trackpad pinch and
 * two-finger touch pinch all move the distance slider).
 */
export function StageView() {
  const box = useRef<HTMLDivElement>(null);
  const clean = useStudio((s) => s.clean);
  const busy = useStudio((s) => s.busy);
  const setClean = useStudio((s) => s.setClean);
  const [fullscreen, setFullscreen] = useState(false);
  const [maxi, setMaxi] = useState(false);
  const [hot, setHot] = useState(false);
  const hotTimer = useRef(0);
  const lastPoint = useRef("");

  // ---- clean view: the eye appears on a real move (browsers also send moves with an unchanged position after a
  // layout change), goes after 2 s without moving, and goes at once when the pointer leaves
  const wake = useCallback(() => {
    setHot(true);
    clearTimeout(hotTimer.current);
    hotTimer.current = window.setTimeout(() => setHot(false), 2000);
  }, []);
  const onPointerMove = (e: React.PointerEvent) => {
    const p = e.clientX + "," + e.clientY;
    if (p === lastPoint.current) return;
    lastPoint.current = p;
    wake();
  };
  const onPointerLeave = () => {
    lastPoint.current = "";
    clearTimeout(hotTimer.current);
    setHot(false);
  };
  const toggleClean = () => {
    const next = !clean;
    setClean(next);
    if (next) {
      clearTimeout(hotTimer.current);
      setHot(false); // hiding clears the eye straight away
    }
  };

  // ---- scanning: once the view settles (or often, lightly, while it spins), and whenever the model or look changes
  useEffect(() => {
    let last = "";
    return subscribeLive(() => {
      const s = useStudio.getState(), key = live.dir.toArray().map((v) => v.toFixed(4)).join() + s.camera.distanceCm;
      if (key === last) return;
      last = key;
      if (s.camera.spin) scheduleScan(150, true);
      else scheduleScan(220);
    });
  }, []);
  const result = useStudio((s) => s.result), model = useStudio((s) => s.model), lookName = useStudio((s) => s.look.look);
  useEffect(() => scheduleScan(120), [result, model, lookName]);

  // ---- full screen
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === box.current);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMaxi(false);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  const toggleFullscreen = async () => {
    if (fullscreen || maxi) {
      setMaxi(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      if (!box.current?.requestFullscreen) throw new Error("no fullscreen");
      await box.current.requestFullscreen();
    } catch {
      setMaxi(true); // blocked (e.g. inside a sandboxed frame): fill the window instead
    }
  };

  // ---- zoom = camera distance
  useEffect(() => {
    const el = box.current!;
    const nudge = (dv: number) => {
      const s = useStudio.getState(), v = Math.max(0, Math.min(1000, cmToSlider(s.camera.distanceCm) + dv));
      s.setCamera({ distanceCm: sliderToCm(v) });
    };
    const onWheel = (e: WheelEvent) => {
      if (!(e.target instanceof HTMLCanvasElement)) return;
      e.preventDefault(); // keeps the page (and a pinch's browser zoom) still
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      nudge(px * (e.ctrlKey ? 3 : 0.4));
    };
    let pinch = 0;
    const gap = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch = gap(e.touches); };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch) return;
      const g = gap(e.touches);
      nudge(((-1000 * Math.log(g / pinch)) / Math.log(50)) * 1.5);
      pinch = g;
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch = 0; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div
      ref={box}
      id="stage"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={(e) => e.target instanceof HTMLCanvasElement && !(e.target as HTMLElement).closest('[role=img]') && useStudio.getState().setCamera({ spin: null })}
      className={`stage area-stage relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-rule bg-sunk max-[900px]:aspect-square ${clean ? "clean" : ""} ${hot ? "hot" : ""} ${maxi ? "!fixed inset-0 z-50 !rounded-none !border-0" : ""} [&:fullscreen]:rounded-none [&:fullscreen]:border-0`}
    >
      <Stage />
      {busy && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[rgba(13,17,23,.65)] font-mono text-sm text-ink" role="status">
          生成中…
        </div>
      )}
      <Hint />
      <ControlBar />
      <RightColumn fullscreen={fullscreen || maxi} onFullscreen={toggleFullscreen} onHide={toggleClean} />
    </div>
  );
}
