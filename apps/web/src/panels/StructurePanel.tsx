import type { Method } from "@tqr/tri-core";
import { useStudio } from "@/store";
import { Field, Note, Panel, inputClass } from "@/components/Panel";
import { t, useT } from "@/i18n";

const METHODS: [Method, string, string][] = [
  ["bridge+strut", "格體橋接＋最少支架", "新方法：用整顆格體把碎塊連起來，只在被定位圖案封住的地方加細支架"],
  ["bridge", "只用格體橋接，不加支架", "主體連成一塊；被封住的小碎塊會分開（數學上無法避免）"],
  ["strut", "細支架（原方法）", "刪掉多餘格體，全部用沿格線的細支架連起來"],
  ["free", "不必相連：最少格體", "適合封在透明樹脂或雷射內雕水晶裡"],
  ["dust", "原始交集", "對照組：所有合法位置都放格體，碎成一千多塊"],
];

function Slider(props: { label: string; value: number; min: number; max: number; step: number; aria: string; onChange(v: number): void }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="font-mono text-[11.5px] tracking-widest text-muted uppercase">{t(props.label)}</span>
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
  const note = METHODS.find(([m]) => m === design.method)![2];
  return (
    <Panel id="structure" title="結構" side="left">
      {model === "tile" ? (
        <>
          <Note>{t("蛋格是一片平放的板子：每個 QR 模組是一個開口的格子，格子四面牆各帶一個方向的碼，格底帶俯視的碼，所以一片能放五個碼。")}</Note>
          <Note>{t("從正上方讀俯視的碼；站到北、東、南、西任一邊，往下斜 35-50° 讀那一邊的碼。示範模型的結構不能調整。")}</Note>
        </>
      ) : (
        <>
          <Field label="連接方式" htmlFor="method" inline={false}>
            <select id="method" className={inputClass} value={design.method} onChange={(e) => setDesign({ method: e.target.value as Method })}>
              {METHODS.map(([v, l]) => (
                <option key={v} value={v}>{t(l)}</option>
              ))}
            </select>
          </Field>
          <Note>{t(note)}</Note>
          {design.method.startsWith("bridge") && (
            <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
              <input type="checkbox" className="mt-0.5 accent-accent" checked={design.relaxed} onChange={(e) => setDesign({ relaxed: e.target.checked })} />
              {t("允許橋接壓過時序、分隔、校正圖案（未認證：碎塊更少，但只靠解碼器實測）")}
            </label>
          )}
          <Slider label="容錯預算" aria="容錯預算" min={20} max={100} step={10} value={design.budget} onChange={(v) => setDesign({ budget: v })} />
          <Note>{t("橋接格最多能用掉多少 QR 糾錯能力。剩下的留給相機雜訊；100% 時實測會讀不到。")}</Note>
          <Slider label="支架粗細（模組寬的比例）" aria="支架粗細" min={10} max={30} step={5} value={design.strut} onChange={(v) => setDesign({ strut: v })} />
        </>
      )}
    </Panel>
  );
}
