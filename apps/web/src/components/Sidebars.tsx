import { useStudio } from "@/store";
import { generate } from "@/lib/actions";
import { ContentPanel } from "@/panels/ContentPanel";
import { StructurePanel } from "@/panels/StructurePanel";
import { LookPanel } from "@/panels/LookPanel";
import { CenterLogoPanel } from "@/panels/CenterLogoPanel";
import { TileContentPanel } from "@/panels/TileContentPanel";
import { OutputPanel } from "@/panels/OutputPanel";
import { SharePanel } from "@/panels/SharePanel";
import { DesignsPanel } from "@/panels/DesignsPanel";
import { useT } from "@/i18n";

/** Left column: design panels that scroll, and the one main action pinned below them. */
export function LeftSidebar() {
  const model = useStudio((s) => s.model);
  const busy = useStudio((s) => s.busy);
  const message = useStudio((s) => s.message);
  const sil = model === "sil";
  const t = useT();
  return (
    <aside className="area-left flex min-h-0 flex-col" aria-label={t("設計")}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-color:var(--color-rule)_transparent] scrollbar-thin max-[900px]:overflow-visible">
        {sil ? <ContentPanel /> : <TileContentPanel />}
        <StructurePanel />
        <LookPanel />
        {sil && <CenterLogoPanel />}
      </div>
      {sil && (
        <div className="flex flex-none flex-col gap-1.5 pt-3" id="genActions">
          {message && (
            <p className="m-0 text-xs leading-snug text-warn" role="status">
              {message}
            </p>
          )}
          <button
            type="button"
            id="gen"
            disabled={busy}
            onClick={() => void generate()}
            className="w-full cursor-pointer rounded-lg border border-accent bg-accent px-2.5 py-2.75 text-[15px] font-bold tracking-[.06em] text-accent-ink disabled:cursor-wait disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t("生成")}
          </button>
        </div>
      )}
    </aside>
  );
}

/** Right column: output and sharing. */
export function RightSidebar() {
  const t = useT();
  return (
    <aside className="area-right flex min-h-0 flex-col gap-3 overflow-y-auto scrollbar-thin" aria-label={t("輸出與分享")}>
      <OutputPanel />
      <DesignsPanel />
      <SharePanel />
    </aside>
  );
}
