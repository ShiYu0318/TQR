import { useStudio } from "@/store";
import { generate } from "@/lib/actions";
import { Note, Panel } from "./Panel";
import { ContentPanel } from "@/panels/ContentPanel";
import { StructurePanel } from "@/panels/StructurePanel";
import { LookPanel } from "@/panels/LookPanel";
import { CenterLogoPanel } from "@/panels/CenterLogoPanel";
import { TileContentPanel } from "@/panels/TileContentPanel";
import { OutputPanel } from "@/panels/OutputPanel";

/** Left column: design panels that scroll, and the one main action pinned below them. */
export function LeftSidebar() {
  const model = useStudio((s) => s.model);
  const busy = useStudio((s) => s.busy);
  const message = useStudio((s) => s.message);
  const sil = model === "sil";
  return (
    <aside className="area-left flex min-h-0 flex-col" aria-label="設計">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-color:var(--color-rule)_transparent] [scrollbar-width:thin] max-[900px]:overflow-visible">
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
            className="w-full cursor-pointer rounded-lg border border-accent bg-accent px-2.5 py-[11px] text-[15px] font-bold tracking-[.06em] text-accent-ink disabled:cursor-wait disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            生成
          </button>
        </div>
      )}
    </aside>
  );
}

/** Right column: output and sharing. */
export function RightSidebar() {
  return (
    <aside className="area-right flex min-h-0 flex-col gap-3 overflow-y-auto [scrollbar-width:thin]" aria-label="輸出與分享">
      <OutputPanel />
      <Panel id="share" title="分享與存檔" side="right">
        <Note>（分享時填入）</Note>
      </Panel>
    </aside>
  );
}
