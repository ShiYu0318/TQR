import { useEffect, useState } from "react";
import { useStudio } from "@/store";
import { Field, Note, Panel, inputClass } from "@/components/Panel";
import { FORMATS, download, sizeNote, type Format } from "@/lib/export";
import { t, useT } from "@/i18n";

const VIEWS = ["上方", "前方", "側面"];
const LIBRARY_ERROR = "無法載入網格函式庫（需要網路）。請重新整理後再試。";

/** Module size, file format (meshes, the silhouette QR of one view, or the view), file name and the download button. */
export function OutputPanel() {
  const model = useStudio((s) => s.model);
  const mm = useStudio((s) => s.moduleMm[s.model]);
  const setModuleMm = useStudio((s) => s.setModuleMm);
  const result = useStudio((s) => s.result);
  useStudio((s) => s.moduleMm); // the size note follows every module size
  useT();
  const [format, setFormat] = useState<Format>("stl");
  const [view, setView] = useState(0);
  const [border, setBorder] = useState(4);
  const [name, setName] = useState("tqr");
  const [draft, setDraft] = useState(String(mm));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean }>({ text: "" });

  useEffect(() => setDraft(String(mm)), [mm, model]);
  // 2D QR silhouettes exist for the generated sculpture only; the side view only when it is a QR
  const qr2d = format === "png-qr" || format === "svg-qr";
  const sideIsQr = result?.kinds[2] === "qr";
  useEffect(() => {
    if (model !== "sil" && qr2d) setFormat("png-view");
  }, [model, qr2d]);
  useEffect(() => {
    if (view === 2 && !sideIsQr) setView(0);
  }, [view, sideIsQr]);

  const run = async () => {
    setBusy(true);
    setMsg({ text: t("產生網格中…") });
    try {
      setMsg({ text: await download({ format, name, view, border }) });
    } catch (e) {
      const text = String((e as Error).message ?? e);
      setMsg({ text: /import|fetch|Failed|wasm/i.test(text) ? t(LIBRARY_ERROR) : text, bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel id="output" title="下載" side="right">
      <div className="flex flex-col gap-1.5 border-b border-rule pb-2.5">
        <Field label="模組邊長" htmlFor="modMM">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              id="modMM"
              min={1}
              max={20}
              step={0.5}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (+e.target.value > 0) setModuleMm(model, +e.target.value);
              }}
              onBlur={() => setDraft(String(mm))}
              className={`${inputClass} w-20 tabular-nums`}
            />
            <span className="text-[12.5px] text-muted">mm</span>
          </div>
        </Field>
        <Note>{sizeNote()}</Note>
      </div>
      <Field label="檔名" htmlFor="outName" inline={false}>
        <input type="text" id="outName" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="檔案格式" htmlFor="outFmt" inline={false}>
        <select id="outFmt" className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as Format)}>
          {FORMATS.map(([v, l]) => (
            <option key={v} value={v} disabled={model !== "sil" && (v === "png-qr" || v === "svg-qr")}>
              {t(l)}
            </option>
          ))}
        </select>
      </Field>
      {qr2d && (
        <div className="flex flex-col gap-1.5" id="out2dWrap">
          <Field label="哪個方向" htmlFor="outView">
            <select id="outView" className={inputClass} value={view} onChange={(e) => setView(+e.target.value)}>
              {VIEWS.map((l, i) => (
                <option key={i} value={i} disabled={i === 2 && !sideIsQr}>
                  {t(l)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="font-mono text-[11.5px] tracking-widest text-muted uppercase">{t("邊框（模組）")}</span>
            <span className="font-mono text-[13px] tabular-nums">{border}</span>
          </div>
          <input type="range" id="outBorder" aria-label={t("邊框（模組）")} min={0} max={8} value={border} onChange={(e) => setBorder(+e.target.value)} className="w-full accent-accent" />
          <Note>{t("QR 剪影就是檢查可解碼保證時用的模組圖案，方向和畫面上看到的一樣；邊框是四周留白的模組數（QR 規格建議 4）。")}</Note>
        </div>
      )}
      <button
        type="button"
        id="dlBtn"
        disabled={busy}
        onClick={() => void run()}
        className="mt-1 w-full cursor-pointer rounded-lg border border-accent bg-accent px-2.5 py-3 text-[15px] font-bold tracking-[.06em] text-accent-ink disabled:cursor-wait disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("下載")}
      </button>
      <p id="dlMsg" aria-live="polite" className={`m-0 min-h-lh text-xs leading-snug ${msg.bad ? "text-bad" : "text-muted"}`}>
        {msg.text}
      </p>
      <Note>{t("3MF 含兩個零件，可直接用雙色印表機。")}</Note>
    </Panel>
  );
}
