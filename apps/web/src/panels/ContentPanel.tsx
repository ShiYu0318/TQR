import { useEffect, useRef, useState } from "react";
import type { Level, Mode } from "@tqr/tri-core";
import { useStudio } from "@/store";
import { CONTENT_TYPES, encodeContent, payloadPreview, type FieldDef } from "@/lib/content";
import { sideLogoImage, type LogoKind } from "@/lib/sideLogo";
import { Field, Note, Panel, inputClass } from "@/components/Panel";
import { t, useT } from "@/i18n";

const VIEW_NAMES = ["上方", "前方", "側面"];
const LEVELS: [Level, string][] = [["L", "L - 低（7%）"], ["M", "M - 中（15%）"], ["Q", "Q - 四分之一（25%）"], ["H", "H - 高（30%）"]];

function ContentField({ def, value, onChange }: { def: FieldDef; value: string | boolean | undefined; onChange(v: string | boolean): void }) {
  const id = "cf_" + def.key;
  if (def.kind === "check")
    return (
      <label className="col-span-full flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
        <input id={id} type="checkbox" className="mt-0.5 accent-accent" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {t(def.label)}
      </label>
    );
  const control =
    def.kind === "select" ? (
      <select id={id} className={inputClass} value={String(value ?? def.options![0][0])} onChange={(e) => onChange(e.target.value)}>
        {def.options!.map(([v, l]) => (
          <option key={v} value={v}>{t(l)}</option>
        ))}
      </select>
    ) : def.kind === "area" ? (
      <textarea id={id} rows={2} className={`${inputClass} min-h-[2.6em] resize-y`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input
        id={id}
        type={def.kind === "date" || def.kind === "time" ? def.kind : "text"}
        spellCheck={false}
        placeholder={def.placeholder && t(def.placeholder)}
        className={`${inputClass} ${def.kind === "text" ? "font-mono text-[12.5px]" : ""}`}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <div className={`flex flex-col gap-0.5 ${def.kind === "area" ? "col-span-full" : ""}`}>
      <label htmlFor={id} className="text-xs text-muted">{t(def.label)}</label>
      {control}
    </div>
  );
}

function SideLogoPreview() {
  const logo = useStudio((s) => s.design.sideLogo);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const n = 29, img = sideLogoImage(logo, n), cv = canvas.current!, g = cv.getContext("2d")!, s = cv.width / n;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#111";
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (img[r * n + q]) g.fillRect(q * s, r * s, Math.ceil(s), Math.ceil(s));
  }, [logo]);
  return <canvas ref={canvas} width={116} height={116} aria-label={t("Logo 預覽")} className="size-[116px] flex-none border border-rule [image-rendering:pixelated]" />;
}

export function ContentPanel() {
  const design = useStudio((s) => s.design);
  const setDesign = useStudio((s) => s.setDesign);
  const setContent = useStudio((s) => s.setContent);
  useT();
  const [edit, setEdit] = useState(0);
  const views = design.mode === "3qr" ? 3 : 2;
  const current = Math.min(edit, views - 1);
  const c = design.content[current], def = CONTENT_TYPES[c.type];
  const logo = design.sideLogo;
  const setLogo = (patch: Partial<typeof logo>) => setDesign({ sideLogo: { ...logo, ...patch } });

  return (
    <Panel id="content" title="內容" side="left">
      <Field label="三個方向放什麼" htmlFor="modeSel" inline={false}>
        <select id="modeSel" className={inputClass} value={design.mode} onChange={(e) => setDesign({ mode: e.target.value as Mode })}>
          <option value="3qr">{t("3 個 QR")}</option>
          <option value="2qr_wall">{t("2 QR＋牆")}</option>
          <option value="2qr_logo">{t("2 QR＋Logo")}</option>
        </select>
      </Field>
      <div className="flex flex-col gap-1">
        <span className="text-[12.5px] text-muted">{t("各方向的內容（點一下切換編輯）")}</span>
        <div className="flex flex-col gap-[3px]" role="group" aria-label={t("各方向的內容")} id="viewList">
          {Array.from({ length: views }, (_, i) => {
            const content = design.content[i];
            return (
              <button
                key={i}
                type="button"
                aria-pressed={i === current}
                onClick={() => setEdit(i)}
                className="vrow grid cursor-pointer grid-cols-[2.4em_auto_minmax(0,1fr)] items-baseline gap-2 rounded-md border border-rule bg-sunk px-2 py-1 text-left text-[12.5px] text-muted aria-pressed:border-accent aria-pressed:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <b className="font-semibold text-ink">{t(VIEW_NAMES[i])}</b>
                <span className="whitespace-nowrap text-accent">{t(CONTENT_TYPES[content.type].label)}</span>
                <span className="truncate font-mono text-[11.5px]">{payloadPreview(encodeContent(content.type, content.fields))}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Field label="內容類型" htmlFor="ctype">
        <select
          id="ctype"
          className={inputClass}
          value={c.type}
          onChange={(e) => e.target.value !== c.type && setContent(current, { type: e.target.value, fields: {} })}
        >
          {Object.entries(CONTENT_TYPES).map(([k, d]) => (
            <option key={k} value={k}>{t(d.label)}</option>
          ))}
        </select>
      </Field>
      <div id="cfields" className={`grid gap-x-2 gap-y-1.5 ${def.fields.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {def.fields.map((fd) => (
          <ContentField key={c.type + fd.key} def={fd} value={c.fields[fd.key]} onChange={(v) => setContent(current, { type: c.type, fields: { ...c.fields, [fd.key]: v } })} />
        ))}
      </div>
      {def.note && <Note>{t(def.note)}</Note>}
      <Field label="容錯率" htmlFor="ecLevel" inline={false}>
        <select id="ecLevel" className={inputClass} value={design.level} onChange={(e) => setDesign({ level: e.target.value as Level })}>
          {LEVELS.map(([v, l]) => (
            <option key={v} value={v}>{t(l)}</option>
          ))}
        </select>
      </Field>
      <Note>{t("等級越低，QR 越小、格體越少，但能拿來橋接的容錯預算也越少。")}</Note>
      {design.mode === "2qr_logo" && (
        <div className="flex flex-col gap-2">
          <Field label="側面的 Logo" htmlFor="logoKind" inline={false}>
            <select id="logoKind" className={inputClass} value={logo.kind} onChange={(e) => setLogo({ kind: e.target.value as LogoKind })}>
              <option value="heart">{t("愛心")}</option>
              <option value="star">{t("星星")}</option>
              <option value="ring">{t("圓環")}</option>
              <option value="text">{t("文字")}</option>
            </select>
          </Field>
          {logo.kind === "text" && (
            <Field label="Logo 文字（1-3 個字最清楚）" htmlFor="logoText" inline={false}>
              <input id="logoText" type="text" className={`${inputClass} font-mono`} value={logo.text} onChange={(e) => setLogo({ text: e.target.value })} />
            </Field>
          )}
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
            <input type="checkbox" className="mt-0.5 accent-accent" checked={logo.badge} onChange={(e) => setLogo({ badge: e.target.checked })} />
            {t("徽章樣式：白色圖案在深色底上（建議；全白的列會讓 QR 整列無法覆蓋）")}
          </label>
          <div className="flex items-center gap-3">
            <SideLogoPreview />
            <Note>{t("側面剪影會長這樣（深色＝有材料）。")}</Note>
          </div>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-mono text-[11.5px] tracking-widest text-muted uppercase">{t("Logo 可犧牲像素")}</span>
            <span className="font-mono text-[13px] tabular-nums">{logo.budget}%</span>
          </div>
          <input type="range" aria-label={t("Logo 可犧牲像素")} min={0} max={30} value={logo.budget} onChange={(e) => setLogo({ budget: +e.target.value })} className="w-full accent-accent" />
        </div>
      )}
      <Field label="QR 版本" htmlFor="version" inline={false}>
        <select id="version" className={inputClass} value={design.version} onChange={(e) => setDesign({ version: +e.target.value })}>
          <option value={0}>{t("自動（能放下內容的最小版本）")}</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>{t("版本 {v}（{n}×{n} 格）", { v, n: 17 + 4 * v })}</option>
          ))}
        </select>
      </Field>
    </Panel>
  );
}
