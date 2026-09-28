import type { Certificate, ImageCheck } from "@tqr/tri-core";
import type { ReactNode } from "react";
import { useStudio } from "@/store";
import { t, useT } from "@/i18n";

const pct = (x: number) => (100 * x).toFixed(0) + "%";

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad"; children: ReactNode }) {
  const c = tone === "ok" ? "text-accent" : tone === "warn" ? "text-warn" : "text-bad";
  return <span className={`inline-block rounded-full border border-current px-1.5 py-px font-mono text-[11px] whitespace-nowrap ${c}`}>{children}</span>;
}

/** how much of each block's error correction the view uses */
function Bars({ e }: { e: Certificate }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {e.blockErrors.map((b, j) => (
        <i key={j} title={t("區塊 {j}：{b}/{c}", { j: j + 1, b, c: e.cap[j] })} className="relative inline-block h-1.5 w-[26px] overflow-hidden rounded-[3px] bg-sunk">
          <b className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${Math.min(100, (100 * b) / e.cap[j])}%` }} />
        </i>
      ))}
    </span>
  );
}

/** Under the stage: the numbers of the current model and the checks it passes (TQR only). */
export function BottomStats() {
  const model = useStudio((s) => s.model);
  const r = useStudio((s) => s.result);
  const spec = useStudio((s) => s.generatedWith);
  const moduleMm = useStudio((s) => s.moduleMm.sil);
  useT();
  if (model !== "sil" || !r || !spec)
    return (
      <section className="area-bottom" aria-label={t("數字資訊與檢查結果")} />
    );
  const names = [t("上方"), t("前方"), t("側面")];
  const qr = r.evals.filter((_, i) => r.kinds[i] === "qr") as Certificate[];
  const cells: [string, string][] = [
    ["v" + r.version, t("QR 版本（{n}×{n} 格，{cm} cm）", { n: r.n, cm: ((r.n * moduleMm) / 10).toFixed(1) })],
    [r.cubes.toLocaleString(), t("格體數") + (r.info?.bridges ? t("（橋接 {b}）", { b: r.info.bridges }) : "")],
    [(r.struts || 0).toLocaleString(), t("細支架段數")],
    [r.pieces.toLocaleString(), t("只算格體時的碎塊數（最大塊佔 {p}）", { p: pct(r.mainShare) })],
  ];
  const onePiece = r.pieces === 1 || r.struts > 0;
  let note = "";
  if (spec.method === "bridge" && r.pieces > 1)
    note = t("剩下的碎塊被定位圖案（或時序、校正圖案）的白色框封住。只用整顆格體、又不破壞這些圖案，數學上不可能連成一件；勾選「允許壓過」可以減少碎塊，或改用「橋接＋最少支架」。");
  if (spec.method === "free") note = t("格體彼此不接觸，這種版本要嵌在透明材料裡（例如雙材質光固化、或雷射內雕水晶）。");
  if (spec.relaxed && spec.method.startsWith("bridge")) note += (note ? " " : "") + t("放寬模式會壓到時序／分隔／校正圖案，不在數學保證範圍內，請以旋轉解碼結果為準。");
  if (spec.mode === "2qr_logo" && ["strut", "free", "dust"].includes(spec.method) && !qr.every((e) => e.ok))
    note += (note ? " " : "") + t("Logo 的白色像素擋住了部分 QR 模組。橋接方法會改用少量 Logo 像素來補，通常能讓兩個 QR 都通過保證。");

  return (
    <section className="area-bottom grid grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] gap-3 max-[900px]:grid-cols-1" aria-label={t("數字資訊與檢查結果")}>
      <div className="grid auto-rows-fr grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule" id="stats">
        {cells.map(([v, l]) => (
          <div key={l} className="flex min-w-0 flex-col gap-0.5 bg-panel px-2.5 py-2">
            <b className="font-mono text-base font-medium tabular-nums">{v}</b>
            <span className="text-xs leading-snug text-muted">{l}</span>
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto rounded-lg border border-rule bg-panel px-3 py-2.5" id="verdictCard">
        <div className="font-mono text-[11.5px] tracking-widest text-muted uppercase">{t("檢查結果")}</div>
        <div className="flex flex-col gap-1 text-[13px]">
          <Row name={t("一體成形")}>
            {onePiece ? <Pill tone="ok">{t("可以印成一件")}</Pill> : spec.method === "free" ? <Pill tone="warn">{t("不相連，需要透明材料包覆")}</Pill> : <Pill tone="warn">{t("{k} 塊分開", { k: r.pieces })}</Pill>}
          </Row>
          {r.evals.map((e, i) => {
            if (r.kinds[i] === "qr") {
              const c = e as Certificate;
              return (
                <Row key={i} name={`${names[i]} QR`}>
                  {c.ok ? <Pill tone="ok">{t("數學保證可解碼")}</Pill> : c.funcErrors ? <Pill tone="warn">{t("定位等功能圖案有 {k} 格不對，未認證", { k: c.funcErrors })}</Pill> : <Pill tone="bad">{t("超出糾錯能力")}</Pill>}
                  <span className="text-xs text-muted">{t("糾錯使用 {u}", { u: c.blockErrors.map((b, j) => `${b}/${c.cap[j]}`).join(t("、")) })}</span>
                  {c.logoBlocks?.some((x) => x) && <span className="text-xs text-muted">{t("Logo 用掉 {u}", { u: c.logoBlocks.join(t("、")) })}</span>}
                  <Bars e={c} />
                </Row>
              );
            }
            const c = e as ImageCheck;
            if (r.kinds[i] === "wall") return <Row key={i} name={t("側面牆")}>{c.missing ? <Pill tone="warn">{t("缺 {k} 格", { k: c.missing })}</Pill> : <Pill tone="ok">{t("完整實心")}</Pill>}</Row>;
            return (
              <Row key={i} name={t("側面 Logo")}>
                <Pill tone={c.missing ? "warn" : "ok"}>{c.missing ? t("缺 {k} 格", { k: c.missing }) : t("形狀完整")}</Pill>
                <span className="text-xs text-muted">{t("多出 {k} 格深色", { k: c.flips })}</span>
              </Row>
            );
          })}
          <Row name={t("計算時間")}>
            <span className="text-xs text-muted">{r.ms} ms</span>
          </Row>
        </div>
        {note && <p className="m-0 text-xs leading-snug text-muted">{note}</p>}
      </div>
    </section>
  );
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <b className="min-w-[4.8em] font-semibold">{name}</b>
      {children}
    </div>
  );
}
