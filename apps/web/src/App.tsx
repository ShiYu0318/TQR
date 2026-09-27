import { Header } from "@/components/Header";

// Layout matches reference.html: header on top, settings left and right of the 3D stage,
// numbers and checks under it. Areas are filled in by the following steps.
export function App() {
  return (
    <div className="app">
      <Header />
      <aside className="area-left flex min-h-0 flex-col gap-3" aria-label="設計">
        <Placeholder title="內容" />
        <Placeholder title="結構" />
        <Placeholder title="外觀" />
      </aside>
      <div className="area-stage relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-rule bg-sunk max-[900px]:aspect-square" />
      <aside className="area-right flex min-h-0 flex-col gap-3" aria-label="輸出與分享">
        <Placeholder title="輸出" />
        <Placeholder title="分享與存檔" />
      </aside>
      <section className="area-bottom grid grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] gap-3 max-[900px]:grid-cols-1" aria-label="數字資訊與檢查結果">
        <div className="rounded-lg border border-rule bg-panel" />
        <div className="rounded-lg border border-rule bg-panel" />
      </section>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-rule bg-panel px-3 py-2.5">
      <h2 className="m-0 text-center font-display text-sm font-bold">{title}</h2>
    </section>
  );
}
