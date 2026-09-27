import { useStudio } from "@/store";

/** Centred along the top edge; says something only when there is nothing to scan (the decoder adds its own hints later). */
export function Hint() {
  const model = useStudio((s) => s.model);
  const result = useStudio((s) => s.result);
  const clean = useStudio((s) => s.clean);
  if (model !== "sil" || result) return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-2.5 left-1/2 z-[2] flex max-w-[calc(100%-210px)] -translate-x-1/2 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 rounded-full border border-rule bg-[rgba(13,17,23,.78)] px-3.5 py-1.5 text-center text-[13px] text-ink backdrop-blur-md transition-[opacity,visibility] duration-200 ${clean ? "invisible opacity-0" : ""}`}
    >
      <b className="font-semibold">還沒有模型</b>
      <span className="text-xs text-muted">填好各方向的內容後按「生成」</span>
    </div>
  );
}
