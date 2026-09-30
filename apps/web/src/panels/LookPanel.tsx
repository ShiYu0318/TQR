import type { ReactNode } from "react";
import { useStudio, type Look, type Shape } from "@/store";
import { Field, Labelled, Note, Panel, inputClass } from "@/components/Panel";
import { Info, Term } from "@/components/Info";
import { Segmented } from "@/components/Segmented";
import { BACKDROPS, BACKDROP_NAMES, GRADIENTS, PALETTE_BASE, PIECE_PALETTES, THEMES, type Colors } from "@/three/palette";
import { filamentContrast } from "@/lib/colour";
import { t, useT } from "@/i18n";

const THEME_NAMES: Record<string, string> = {
  custom: "自訂", classic: "經典黑白", cyan: "圓潤青色", tech: "現代科技藍", facebook: "Facebook 藍", whatsapp: "WhatsApp 綠",
  youtube: "YouTube 紅", orange: "橘色活力",
};
const PALETTE_NAMES: Record<string, string> = { default: "預設", rainbow: "彩虹", pastel: "粉彩", neon: "霓虹", warm: "暖色", cool: "冷色", github: "GitHub" };
const GRADIENT_NAMES: Record<string, string> = { ocean: "海洋", sunset: "日落", aurora: "極光", fire: "火焰", mint: "薄荷", candy: "糖果", mono: "灰階", github: "GitHub" };
const LOOK_NOTES: Record<Look, string> = {
  sil: "黑色剪影配白色背光，是掃描時真正看到的樣子。",
  real: "單一材質印出來的樣子，顏色可以自己選；掃描時仍要背光看剪影。",
  solid: "三種顏色分別標出原本就合法的格體、橋接格與細支架。",
  pieces: "最大的一塊用自己的顏色，其他每個分開的碎塊依色彩系列輪流上色。",
};

function Swatch({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px]">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-5.5 w-7 cursor-pointer rounded border border-rule bg-transparent p-0" />
      <span>{t(label)}</span>
    </label>
  );
}

function Colours({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">{children}</div>;
}

export function LookPanel() {
  const model = useStudio((s) => s.model);
  const look = useStudio((s) => s.look);
  const setLook = useStudio((s) => s.setLook);
  const method = useStudio((s) => s.generatedWith?.method);
  const c = look.colors, sil = model === "sil";
  useT();
  // only the colours a quick style sets turn the style back to "custom" when edited by hand
  const setColors = (patch: Partial<Colors>, custom = false) => setLook({ colors: { ...c, ...patch }, ...(custom ? { theme: "custom" } : {}) });
  const unconnected = method === "free";

  const applyTheme = (name: string) => {
    const th = THEMES[name];
    if (!th) return setLook({ theme: "custom" });
    setLook({
      theme: name,
      shape: (th.shape as Shape) ?? "cube",
      colors: { ...c, model: th.model, finder: th.finder, dark: th.dark, light: th.light },
      // a quick style is about colour: show it, not the black backlit silhouette
      ...(sil && look.look === "sil" ? { look: "real" as Look } : {}),
    });
  };
  const gradStops = c.gradient === "custom" ? [c.gradA, c.gradB] : (GRADIENTS[c.gradient] ?? GRADIENTS.ocean);
  const pal = PIECE_PALETTES[c.palette] ?? PIECE_PALETTES.default;
  const contrast = filamentContrast(c.dark, c.light);
  const shape = !unconnected && (look.shape === "cylinder" || look.shape === "sphere") ? "cube" : look.shape;

  return (
    <Panel id="look" title="外觀" side="left">
      <Field label="快速樣式" htmlFor="theme">
        <select id="theme" className={inputClass} value={look.theme} onChange={(e) => applyTheme(e.target.value)}>
          {Object.entries(THEME_NAMES).map(([k, n]) => (
            <option key={k} value={k}>{t(n)}</option>
          ))}
        </select>
      </Field>
      {sil && (
        <div className="flex flex-col gap-1">
          <Labelled
            topic="顯示方式"
            info={(
              [
                ["sil", "背光剪影"],
                ["real", "實物"],
                ["solid", "結構"],
                ["pieces", "碎塊"],
              ] as [Look, string][]
            ).map(([k, name]) => (
              <Term key={k} name={t(name)}>
                {t(LOOK_NOTES[k])}
              </Term>
            ))}
          >
            <span className="text-[12.5px] text-muted">{t("顯示方式")}</span>
          </Labelled>
          <Segmented
            label={t("顯示方式")}
            value={look.look}
            onChange={(v) => setLook({ look: v })}
            options={[
              { value: "sil", label: t("背光剪影") },
              { value: "real", label: t("實物") },
              { value: "solid", label: t("結構") },
              { value: "pieces", label: t("碎塊") },
            ]}
            className="[&>button]:py-1 [&>button]:text-[13px]"
          />
        </div>
      )}
      <Field label="背景" htmlFor="bgSel" info={<p>{t("背光剪影固定用白色背光，掃描才讀得到；其他顯示方式和蛋格會用這個背景。")}</p>}>
        <select id="bgSel" className={inputClass} value={look.backdrop} onChange={(e) => setLook({ backdrop: e.target.value })}>
          {Object.keys(BACKDROPS).map((k) => (
            <option key={k} value={k}>{t(BACKDROP_NAMES[k])}</option>
          ))}
        </select>
      </Field>
      <label className="flex cursor-pointer items-start gap-2 text-[12.5px]">
        <input type="checkbox" className="mt-0.5 accent-accent" checked={look.floor} onChange={(e) => setLook({ floor: e.target.checked })} />
        {t("底盤陰影")}
      </label>
      {sil && (
        <>
          <Field
            label="格體形狀"
            htmlFor="shape"
            info={
              <>
                <Term name={t("圓角方塊")}>{t("圓角方塊的面中央仍然互相接觸，可以印成一件。")}</Term>
                <Term name={t("圓柱和球")}>{t("圓柱和球之間只有線或點接觸，只適合封在透明材料裡；剪影會變成圓點，定位圖案可能讀不到。")}</Term>
              </>
            }
          >
            <select id="shape" className={inputClass} value={shape} onChange={(e) => setLook({ shape: e.target.value as Shape })}>
              <option value="cube">{t("方塊")}</option>
              <option value="rounded">{t("圓角方塊")}</option>
              <option value="cylinder" disabled={!unconnected}>{t("圓柱（只限不必相連）")}</option>
              <option value="sphere" disabled={!unconnected}>{t("球（只限不必相連）")}</option>
            </select>
          </Field>
        </>
      )}
      {sil && look.look === "real" && (
        <Colours>
          <div className="basis-full">
            <Field label="上色" htmlFor="fillMode" info={<p>{t("漸層只影響畫面；匯出的檔案仍是單色（用模型顏色）。")}</p>}>
              <select id="fillMode" className={inputClass} value={c.fill} onChange={(e) => setColors({ fill: e.target.value as Colors["fill"] })}>
                <option value="solid">{t("單色")}</option>
                <option value="gradient">{t("漸層")}</option>
              </select>
            </Field>
          </div>
          {c.fill === "gradient" ? (
            <div className="flex basis-full flex-col gap-1.75">
              <Field label="色系" htmlFor="gradPreset">
                <select id="gradPreset" className={inputClass} value={c.gradient} onChange={(e) => setColors({ gradient: e.target.value })}>
                  {Object.keys(GRADIENTS).map((k) => (
                    <option key={k} value={k}>{t(GRADIENT_NAMES[k])}</option>
                  ))}
                  <option value="custom">{t("自訂")}</option>
                </select>
              </Field>
              {c.gradient === "custom" && (
                <Colours>
                  <Swatch label="起點" value={c.gradA} onChange={(v) => setColors({ gradA: v })} />
                  <Swatch label="終點" value={c.gradB} onChange={(v) => setColors({ gradB: v })} />
                </Colours>
              )}
              <Field label="漸層方向" htmlFor="gradDir">
                <select id="gradDir" className={inputClass} value={c.gradDir} onChange={(e) => setColors({ gradDir: e.target.value as Colors["gradDir"] })}>
                  <option value="up">{t("由下到上")}</option>
                  <option value="lr">{t("由左到右")}</option>
                  <option value="fb">{t("由前到後")}</option>
                  <option value="diag">{t("對角")}</option>
                </select>
              </Field>
              <div aria-hidden="true" className="h-3 rounded border border-rule" style={{ background: `linear-gradient(to right, ${gradStops.join(", ")})` }} />
            </div>
          ) : (
            <>
              <Swatch label="模型顏色" value={c.model} onChange={(v) => setColors({ model: v }, true)} />
              <span className="inline-flex items-center gap-1">
                <Swatch label="定位圖案顏色" value={c.finder} onChange={(v) => setColors({ finder: v }, true)} />
                <Info topic="定位圖案顏色">
                  <p>{t("定位圖案顏色和模型不同時，就是雙材質列印；形狀不變，所以仍然保證可解碼。")}</p>
                </Info>
              </span>
            </>
          )}
        </Colours>
      )}
      {sil && look.look === "solid" && (
        <Colours>
          <Swatch label="合法格體" value={c.base} onChange={(v) => setColors({ base: v })} />
          <Swatch label="橋接格" value={c.bridge} onChange={(v) => setColors({ bridge: v })} />
          <Swatch label="細支架" value={c.strut} onChange={(v) => setColors({ strut: v })} />
        </Colours>
      )}
      {sil && look.look === "pieces" && (
        <div className="flex flex-col gap-1.75">
          <Field label="色彩系列" htmlFor="piecePal">
            <select
              id="piecePal"
              className={inputClass}
              value={c.palette}
              onChange={(e) => {
                const base = PALETTE_BASE[e.target.value];
                setColors({ palette: e.target.value, ...(base ? { main: base.main, strut: base.strut } : {}) });
              }}
            >
              {Object.keys(PIECE_PALETTES).map((k) => (
                <option key={k} value={k}>{t(PALETTE_NAMES[k])}</option>
              ))}
            </select>
          </Field>
          <div aria-hidden="true" className="grid h-3 grid-cols-8 gap-0.75">
            {pal.map((h) => (
              <i key={h} className="rounded-[3px]" style={{ background: "#" + h.toString(16).padStart(6, "0") }} />
            ))}
          </div>
          <Colours>
            <Swatch label="最大一塊" value={c.main} onChange={(v) => setColors({ main: v })} />
            <Swatch label="細支架" value={c.strut} onChange={(v) => setColors({ strut: v })} />
          </Colours>
        </div>
      )}
      {!sil && (
        <Colours>
          <Swatch label="深色線材" value={c.dark} onChange={(v) => setColors({ dark: v }, true)} />
          <Swatch label="淺色線材" value={c.light} onChange={(v) => setColors({ light: v }, true)} />
          <div className="basis-full">
            <Note tone={contrast.tone}>{contrast.message}</Note>
          </div>
        </Colours>
      )}
    </Panel>
  );
}
