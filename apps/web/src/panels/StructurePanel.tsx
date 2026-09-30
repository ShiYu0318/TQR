import type { Method } from "@tqr/tri-core";
import { useStudio } from "@/store";
import { Field, Labelled, Note, Panel, inputClass } from "@/components/Panel";
import { Info, Term } from "@/components/Info";
import type { ReactNode } from "react";
import { t, useT } from "@/i18n";

const METHODS: [Method, string, string][] = [
  ["bridge+strut", "格體橋接＋最少支架", "用整顆格體把碎塊連起來，只在被定位圖案封住的地方加細支架"],
  ["bridge", "只用格體橋接，不加支架", "主體連成一塊；被封住的小碎塊會分開（數學上無法避免）"],
  ["strut", "細支架", "刪掉多餘格體，全部用沿格線的細支架連起來"],
  ["free", "不必相連：最少格體", "適合封在透明樹脂或雷射內雕水晶裡"],
  ["dust", "原始交集", "對照組：所有合法位置都放格體，會碎成非常多塊"],
];

function Slider(props: { label: string; value: number; min: number; max: number; step: number; aria: string; info?: ReactNode; onChange(v: number): void }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <Labelled topic={props.label} info={props.info}>
          <span className="font-mono text-[11.5px] tracking-widest text-muted uppercase">{t(props.label)}</span>
        </Labelled>
        <span className="font-mono text-[13px] tabular-nums">{props.value}%</span>
      </div>
      <input type="range" aria-label={t(props.aria)} min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(+e.target.value)} className="w-full accent-accent" />
    </>
  );
}

export function StructurePanel() {
  const model = useStudio((s) => s.model);
  const design = useStudio((s) => s.design);
  const setDesign = useStudio((s) => s.setDesign);
  useT();
  return (
    <Panel id="structure" title="結構" side="left">
      {model === "tile" ? (
        <>
          <div className="flex items-center gap-1.5">
            <Note>{t("示範模型的結構不能調整。")}</Note>
            <Info topic="結構">
              <p>{t("蛋格是一片平放的板子：每個 QR 模組是一個開口的格子，格子四面牆各帶一個方向的碼，格底帶俯視的碼，所以一片能放五個碼。")}</p>
              <p>{t("從正上方讀俯視的碼；站到北、東、南、西任一邊，往下斜 35° 到 50° 讀那一邊的碼。")}</p>
            </Info>
          </div>
        </>
      ) : (
        <>
          <Field
            label="連接方式"
            htmlFor="method"
            inline={false}
            info={METHODS.map(([v, l, d]) => (
              <Term key={v} name={t(l)}>
                {t(d)}
              </Term>
            ))}
          >
            <select id="method" className={inputClass} value={design.method} onChange={(e) => setDesign({ method: e.target.value as Method })}>
              {METHODS.map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
          </Field>
          {design.method.startsWith("bridge") && (
            <Labelled topic="允許橋接壓過時序、分隔、校正圖案" info={<p>{t("碎塊會更少，但這些格子不在數學保證的範圍內，能不能讀只能靠解碼器實測。定位圖案和格式資訊不會被壓過。")}</p>}>
              <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
                <input type="checkbox" className="mt-0.5 accent-accent" checked={design.relaxed} onChange={(e) => setDesign({ relaxed: e.target.checked })} />
                {t("允許橋接壓過時序、分隔、校正圖案")}
              </label>
            </Labelled>
          )}
          <Slider
            label="容錯預算"
            aria="容錯預算"
            min={20}
            max={100}
            step={10}
            value={design.budget}
            info={<p>{t("橋接格最多能用掉多少 QR 糾錯能力。剩下的留給相機雜訊；100% 時實測會讀不到。")}</p>}
            onChange={(v) => setDesign({ budget: v })}
          />
          <Slider
            label="支架粗細"
            aria="支架粗細"
            min={10}
            max={30}
            step={5}
            value={design.strut}
            info={<p>{t("細支架的寬度，以模組邊長的百分比表示。")}</p>}
            onChange={(v) => setDesign({ strut: v })}
          />
        </>
      )}
    </Panel>
  );
}
