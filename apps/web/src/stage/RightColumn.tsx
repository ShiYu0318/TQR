import { useEffect, useRef, type ReactNode } from "react";
import { useStudio } from "@/store";
import { ISO_ELEVATION, cmToSlider, formatDistance, live, sliderToCm, subscribeLive } from "@/three/live";
import { Gizmo } from "./Gizmo";
import { useT } from "@/i18n";
import { EyeIcon, FullscreenIcon, ResetIcon } from "./icons";

/** frosted card floating over the 3D view */
export const overlay = "rounded-lg border border-rule bg-[rgba(13,17,23,.82)] text-ink backdrop-blur-md";

function StageButton(props: { label: string; pressed?: boolean; onClick(): void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={`${overlay} grid min-h-9.25 flex-1 cursor-pointer place-items-center p-0 transition-[opacity,visibility] duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:[&>svg]:scale-90 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

function Readout() {
  const t = useT();
  const az = useRef<HTMLElement>(null), el = useRef<HTMLElement>(null);
  useEffect(() => {
    let last = "";
    return subscribeLive(() => {
      let a = live.azimuth.toFixed(1), e = live.elevation.toFixed(1);
      if (a === "360.0") a = "0.0";
      if (e === "-0.0") e = "0.0";
      if (a + e === last) return;
      last = a + e;
      az.current!.textContent = a + "°";
      el.current!.textContent = e + "°";
    });
  }, []);
  return (
    <dl className="m-0 grid gap-px font-mono text-[11.5px] tabular-nums">
      <div className="flex justify-between gap-2.5">
        <dt className="text-[10px] tracking-widest text-muted uppercase">{t("方位")}</dt>
        <dd ref={az} className="m-0 text-right">0.0°</dd>
      </div>
      <div className="flex justify-between gap-2.5">
        <dt className="text-[10px] tracking-widest text-muted uppercase">{t("仰角")}</dt>
        <dd ref={el} className="m-0 text-right">0.0°</dd>
      </div>
    </dl>
  );
}

function VSlider(props: { label: string; aria: string; value: number; min: number; max: number; step?: number; display: string; onChange(v: number): void }) {
  return (
    <div className="grid min-h-0 w-12 grid-rows-[auto_minmax(0,1fr)_auto] justify-items-center gap-1.5">
      <span className="font-mono text-[11px] whitespace-nowrap tabular-nums">{props.display}</span>
      <input
        type="range"
        aria-label={props.aria}
        aria-orientation="vertical"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(+e.target.value)}
        className="m-0 h-full min-h-15 w-4.5 p-0 accent-accent [direction:rtl] [writing-mode:vertical-lr]"
      />
      <span className="text-[10px] text-muted">{props.label}</span>
    </div>
  );
}

interface Props {
  fullscreen: boolean;
  onFullscreen(): void;
  onHide(): void;
}

/** reset / full screen / hide, the gizmo, and the distance and speed sliders: one 116 px column down the right edge */
export function RightColumn({ fullscreen, onFullscreen, onHide }: Props) {
  const model = useStudio((s) => s.model);
  const clean = useStudio((s) => s.clean);
  const distanceCm = useStudio((s) => s.camera.distanceCm);
  const spinSpeed = useStudio((s) => s.camera.spinSpeed);
  const setCamera = useStudio((s) => s.setCamera);
  const t = useT();
  const hide = clean ? "invisible opacity-0 pointer-events-none" : "";

  const reset = () => {
    const s = useStudio.getState();
    s.setCamera({ spin: null });
    s.requestView(45, ISO_ELEVATION, s.camera.distanceCm);
    s.resetFound(model); // reset also forgets which links were scanned
  };

  return (
    <div className="pointer-events-none absolute top-2 right-2 bottom-[calc(var(--barh,110px)+14px)] z-2 flex w-29 flex-col items-stretch gap-1.5 max-[900px]:static max-[900px]:w-auto">
      <div className="pointer-events-auto flex gap-1.5">
        <StageButton label={t("回到最佳視角（等角：方位 45°、仰角 35.26°）")} onClick={reset} className={hide}>
          <ResetIcon />
        </StageButton>
        <StageButton label={t(fullscreen ? "離開全螢幕（Esc）" : "全螢幕")} pressed={fullscreen} onClick={onFullscreen} className={hide}>
          <FullscreenIcon inward={fullscreen} />
        </StageButton>
        <StageButton
          label={t(clean ? "顯示控制元件" : "隱藏畫面上的控制元件")}
          pressed={clean}
          onClick={onHide}
          className="eye-button"
        >
          <EyeIcon off={!clean} />
        </StageButton>
      </div>
      <div className={`${overlay} pointer-events-auto flex flex-col gap-1 px-2 py-1.5 transition-[opacity,visibility] duration-200 ${hide}`}>
        <Gizmo />
        <Readout />
      </div>
      <div className={`${overlay} pointer-events-auto flex min-h-0 flex-1 justify-around gap-1 px-1.5 pt-2.5 pb-2 transition-[opacity,visibility] duration-200 max-[900px]:flex-none ${hide}`}>
        <VSlider
          label={t("距離")}
          aria={t("相機距離")}
          value={cmToSlider(distanceCm)}
          min={0}
          max={1000}
          display={formatDistance(distanceCm)}
          onChange={(v) => setCamera({ distanceCm: sliderToCm(v) })}
        />
        <VSlider
          label={t("轉速")}
          aria={t("旋轉速度（每秒幾度）")}
          value={spinSpeed}
          min={5}
          max={90}
          display={`${spinSpeed}°/s`}
          onChange={(v) => setCamera({ spinSpeed: v })}
        />
      </div>
    </div>
  );
}
