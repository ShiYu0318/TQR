import { useStudio } from "@/store";
import { useT } from "@/i18n";

/**
 * Centred along the top edge; speaks only when there is nothing of this model to scan here: no model yet, still
 * reading, or the decoder found no link of this model (with the reason). While a link decodes it stays quiet and the
 * link column lights instead.
 */
export function Hint() {
  const model = useStudio((s) => s.model);
  const result = useStudio((s) => s.result);
  const scan = useStudio((s) => s.scan);
  const clean = useStudio((s) => s.clean);
  const t = useT();
  let main: string, sub: string;
  if (model === "sil" && !result) (main = t("還沒有模型")), (sub = t("填好各方向的內容後按「生成」"));
  else if (!scan.ready) (main = t("讀取中…")), (sub = "");
  else if (scan.key) return null;
  else if (scan.text) (main = scan.text), (sub = t(scan.reason));
  else (main = t("這個角度沒有解出碼")), (sub = t(scan.reason));
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-2.5 left-1/2 z-2 flex max-w-[calc(100%-210px)] -translate-x-1/2 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 rounded-full border border-rule bg-[rgba(13,17,23,.78)] px-3.5 py-1.5 text-center text-[13px] text-ink backdrop-blur-md transition-[opacity,visibility] duration-200 max-[900px]:static max-[900px]:max-w-none max-[900px]:translate-x-0 max-[900px]:rounded-none ${clean ? "invisible opacity-0" : ""}`}
    >
      <b className="font-semibold break-all">{main}</b>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
