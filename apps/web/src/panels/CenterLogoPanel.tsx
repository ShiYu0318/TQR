import { useEffect, useRef } from "react";
import { useStudio } from "@/store";
import { Field, Note, Panel, inputClass } from "@/components/Panel";
import { bitsFromImage, centerLogoOverlay, LOGO_FONTS, type CenterLogo, type CenterStyle } from "@/lib/centerLogo";
import { encodeContent } from "@/lib/content";
import { qrMatrix, qrVersion } from "@/lib/qr";
import { t, useT } from "@/i18n";

const FONT_NAMES: Record<keyof typeof LOGO_FONTS, string> = {
  sans: "系統預設黑體", jhenghei: "微軟正黑體", pingfang: "蘋方 (Apple)", kai: "標楷體", serif: "系統預設明體", mono: "等寬字體",
};

function Slider(props: { label: string; value: number; min: number; max: number; onChange(v: number): void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11.5px] tracking-widest text-muted uppercase">{t(props.label)}</span>
        <span className="font-mono text-[13px] tabular-nums">{props.value}</span>
      </div>
      <input type="range" aria-label={t(props.label)} min={props.min} max={props.max} value={props.value} onChange={(e) => props.onChange(+e.target.value)} className="w-full accent-accent" />
    </div>
  );
}

/** the top view's QR with the logo in blue, as seen from the top preset */
function Preview({ L }: { L: CenterLogo }) {
  const design = useStudio((s) => s.design);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current!, g = cv.getContext("2d")!, text = encodeContent(design.content[0].type, design.content[0].fields) || "QR";
    let M: Uint8Array;
    try {
      M = qrMatrix(text, Math.max(1, design.version || qrVersion(text, design.level)), design.level);
    } catch {
      return;
    }
    const n = Math.round(Math.sqrt(M.length)), o = centerLogoOverlay(n, L, 0), s = cv.width / (n + 4);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const i = r * n + c, inLogo = o && o.region[i], on = inLogo ? o.pixels[i] : M[i];
        if (!on) continue;
        g.fillStyle = inLogo ? "#1f6feb" : "#111";
        g.fillRect((n - 1 - r + 2) * s, (c + 2) * s, Math.ceil(s), Math.ceil(s));
      }
  }, [L, design.content, design.version, design.level]);
  return <canvas ref={canvas} width={120} height={120} aria-label={t("Logo 預覽")} className="size-30 flex-none rounded border border-rule [image-rendering:pixelated]" />;
}

export function CenterLogoPanel() {
  const L = useStudio((s) => s.design.centerLogo);
  const mode = useStudio((s) => s.design.mode);
  const setDesign = useStudio((s) => s.setDesign);
  const set = (patch: Partial<CenterLogo>) => setDesign({ centerLogo: { ...L, ...patch } });
  const on = L.kind !== "none";
  useT();

  const upload = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      set({ image: { size: 32, bits: Array.from(bitsFromImage(img, 32)) } });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <Panel id="logo" title="Logo" side="left">
      <Field label="Logo 類型" htmlFor="clKind">
        <select id="clKind" className={inputClass} value={L.kind} onChange={(e) => set({ kind: e.target.value as CenterLogo["kind"] })}>
          <option value="none">{t("不放 Logo")}</option>
          <option value="text">{t("文字 Logo")}</option>
          <option value="image">{t("圖片 Logo")}</option>
        </select>
      </Field>
      {L.kind === "text" && (
        <>
          <Field label="文字" htmlFor="clText">
            <input id="clText" type="text" maxLength={6} spellCheck={false} className={`${inputClass} font-mono`} value={L.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="字型" htmlFor="clFont">
            <select id="clFont" className={inputClass} value={L.font} onChange={(e) => set({ font: e.target.value as CenterLogo["font"] })}>
              {Object.entries(FONT_NAMES).map(([k, n]) => (
                <option key={k} value={k}>{t(n)}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      {L.kind === "image" && (
        <Field label="上傳 Logo 圖檔（會轉成黑白格子）" htmlFor="clFile" inline={false}>
          <input id="clFile" type="file" accept="image/*" className="text-xs text-muted" onChange={(e) => upload(e.target.files?.[0])} />
        </Field>
      )}
      {on && (
        <>
          <Field label="背景樣式" htmlFor="clStyle">
            <select id="clStyle" className={inputClass} value={L.style} onChange={(e) => set({ style: e.target.value as CenterStyle })}>
              <option value="box">{t("方框")}</option>
              <option value="bar">{t("長條")}</option>
              <option value="outline">{t("字外框")}</option>
              <option value="clear">{t("透明底")}</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Slider label="Logo 尺寸" min={5} max={21} value={L.size} onChange={(v) => set({ size: v })} />
            <Slider label="Logo 邊寬" min={0} max={3} value={L.margin} onChange={(v) => set({ margin: v })} />
            <Slider label="水平位置" min={-6} max={6} value={L.dx} onChange={(v) => set({ dx: v })} />
            <Slider label="垂直位置" min={-6} max={6} value={L.dy} onChange={(v) => set({ dy: v })} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] text-muted">{t("放在哪些方向")}</span>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1">
              {["上方", "前方", "側面"].map((name, i) =>
                i === 2 && mode !== "3qr" ? null : (
                  <label key={i} className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={L.views.includes(i)}
                      onChange={(e) => set({ views: e.target.checked ? [...L.views, i].sort() : L.views.filter((v) => v !== i) })}
                    />
                    {t(name)}
                  </label>
                ),
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Preview L={L} />
            <Note>{t("預覽從上方看到的 QR，藍色是 Logo。Logo 改動的碼字會先從糾錯能力扣掉，橋接只用剩下的能力，所以仍然保證可解碼。")}</Note>
          </div>
        </>
      )}
    </Panel>
  );
}
