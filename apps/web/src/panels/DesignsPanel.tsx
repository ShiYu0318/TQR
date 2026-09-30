import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/store";
import { Panel, PanelIcon, buttonClass, inputClass } from "@/components/Panel";
import {
  currentId,
  deleteDesign,
  designStore,
  duplicateDesign,
  exportAll,
  importText,
  listDesigns,
  loadDesign,
  newDesign,
  renameDesign,
  saveNew,
  updateDesign,
  type DesignRecord,
} from "@/lib/designs";
import { getState } from "@/lib/share";
import { saveBlob } from "@/lib/export/formats";
import { t, useT } from "@/i18n";

const small = "cursor-pointer rounded border border-rule bg-transparent px-1.5 py-0.5 text-[11.5px] text-muted hover:border-muted hover:text-ink disabled:cursor-default disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-accent";

function Thumb({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" className="h-12 w-16 flex-none rounded border border-rule object-cover" />
  ) : (
    <span aria-hidden="true" className="grid h-12 w-16 flex-none place-items-center rounded border border-rule bg-sunk text-muted">
      <PanelIcon>
        <path d="M8 2.5 13.5 5.5v5L8 13.5 2.5 10.5v-5z" />
        <path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" />
      </PanelIcon>
    </span>
  );
}

/** Designs kept in this browser: save, update, open, rename, duplicate, delete, or start a new one. */
export function DesignsPanel() {
  useT();
  const lang = useStudio((s) => s.lang);
  const busy = useStudio((s) => s.busy);
  const [items, setItems] = useState<DesignRecord[]>([]);
  const [current, setCurrent] = useState<string | null>(currentId);
  const [durable, setDurable] = useState(true);
  const [msg, setMsg] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const file = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setItems(await listDesigns());
    setCurrent(currentId());
  };
  useEffect(() => {
    void designStore().then((s) => setDurable(s.durable));
    void refresh();
    return () => clearTimeout(timer.current);
  }, []);

  const open = items.find((d) => d.id === current) ?? null;
  const when = (ms: number) => new Date(ms).toLocaleString(lang === "zh" ? "zh-TW" : "en-US", { dateStyle: "short", timeStyle: "short", hour12: false });
  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      setMsg(done);
    } catch {
      setMsg(t("這個瀏覽器不允許儲存（例如無痕模式）。可以改用匯出 JSON。"));
    }
    await refresh();
  };

  const save = () => run(() => saveNew(), t("已存成新的設計。"));
  const update = () => open && run(() => updateDesign(open.id), t("已更新「{n}」。", { n: open.name }));
  const load = (d: DesignRecord) => run(() => loadDesign(d.id), d.result ? t("已開啟「{n}」。", { n: d.name }) : t("已開啟「{n}」，正在重新生成模型。", { n: d.name }));
  const copy = (d: DesignRecord) => run(() => duplicateDesign(d.id), t("已複製「{n}」。", { n: d.name }));
  const rename = async () => {
    if (!renaming) return;
    const { id, name } = renaming;
    setRenaming(null);
    await run(() => renameDesign(id, name), t("已改名。"));
  };
  const remove = (d: DesignRecord) => {
    clearTimeout(timer.current);
    if (confirmDelete !== d.id) {
      setConfirmDelete(d.id);
      timer.current = setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setConfirmDelete(null);
    void run(() => deleteDesign(d.id), t("已刪除「{n}」。", { n: d.name }));
  };
  const exportEverything = async () => {
    const { text, count } = await exportAll();
    saveBlob(new Blob([text], { type: "application/json" }), "tqr-designs.json");
    setMsg(t("已匯出 {k} 個設計到 tqr-designs.json。", { k: count }));
  };
  const exportCurrent = () => {
    saveBlob(new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" }), "tqr-settings.json");
    setMsg(t("已匯出 tqr-settings.json。"));
  };
  const importFiles = async (files: FileList | null) => {
    let added = 0, skipped = 0, bad = 0;
    for (const f of Array.from(files ?? [])) {
      try {
        const r = await importText(await f.text(), f.name);
        added += r.added;
        skipped += r.skipped;
      } catch {
        bad++;
      }
    }
    if (file.current) file.current.value = "";
    setMsg(
      bad && !added
        ? t("這個檔案不是 TQR Studio 的設定檔。")
        : t("已匯入 {a} 個設計", { a: added }) + (skipped ? t("，略過 {s} 個重複的", { s: skipped }) : "") + (bad ? t("，{b} 個檔案無法讀取", { b: bad }) : "") + t("。"),
    );
    await refresh();
  };
  const start = () => {
    newDesign();
    setCurrent(null);
    setMsg(t("已開始新的設計。"));
  };

  return (
    <Panel id="designs" title="儲存" side="right">
      {/* a long design name gets its own row, so the other buttons never get pushed out */}
      {open && (
        <button type="button" id="updateDesign" className={`${buttonClass} min-w-0`} onClick={() => void update()} title={t("用目前的設計覆蓋「{n}」", { n: open.name })}>
          <span className="truncate">{t("更新「{n}」", { n: open.name })}</span>
        </button>
      )}
      <div className="flex gap-2">
        <button type="button" id="saveDesign" className={buttonClass} onClick={() => void save()}>
          <PanelIcon>
            <path d="M3 2.5h8l2.5 2.5v8.5h-10.5z" />
            <path d="M5.5 2.5v3h5v-3" />
            <rect x="5" y="9" width="6" height="4.5" />
          </PanelIcon>
          <span>{open ? t("另存新的") : t("儲存目前設計")}</span>
        </button>
        <button type="button" id="newDesign" className={`${buttonClass} flex-none`} onClick={start} disabled={busy}>
          {t("新設計")}
        </button>
      </div>
      {!durable && <p className="m-0 text-xs leading-snug text-warn">{t("這個瀏覽器不允許長期儲存，關掉頁面後清單就會消失。要保留請用匯出。")}</p>}
      {items.length ? (
        <ul className="m-0 flex max-h-[330px] list-none flex-col gap-1.5 overflow-y-auto p-0 scrollbar-thin" id="designList" aria-label={t("我的設計")}>
          {items.map((d) => (
            <li key={d.id} className={`flex gap-2.5 rounded-md border p-1.5 ${d.id === current ? "border-accent" : "border-rule"}`}>
              <Thumb src={d.thumb} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {renaming?.id === d.id ? (
                  <input
                    autoFocus
                    aria-label={t("新名稱")}
                    className={`${inputClass} py-0.5`}
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: d.id, name: e.target.value })}
                    onBlur={() => void rename()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void rename();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <b className="truncate text-[13px] font-semibold" title={d.name}>
                    {d.name}
                  </b>
                )}
                <span className="text-[11px] text-muted tabular-nums">
                  {when(d.updated)}
                  {d.result ? " · " + t("含模型") : ""}
                </span>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={small} disabled={busy} onClick={() => void load(d)}>
                    {t("開啟")}
                  </button>
                  <button type="button" className={small} onClick={() => setRenaming({ id: d.id, name: d.name })}>
                    {t("改名")}
                  </button>
                  <button type="button" className={small} onClick={() => void copy(d)}>
                    {t("複製")}
                  </button>
                  <button type="button" className={`${small} ${confirmDelete === d.id ? "border-bad text-bad" : ""}`} onClick={() => remove(d)}>
                    {confirmDelete === d.id ? t("再按一次刪除") : t("刪除")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xs leading-snug text-muted">{t("還沒有儲存的設計。按「儲存目前設計」把現在的設計收進來。")}</p>
      )}
      <div className="flex flex-col gap-2 border-t border-rule pt-2.5">
        <div className="flex gap-2">
          <button type="button" id="exportAll" className={buttonClass} disabled={!items.length} onClick={() => void exportEverything()}>
            {t("匯出全部")}
          </button>
          <button type="button" id="importDesigns" className={buttonClass} onClick={() => file.current?.click()}>
            {t("匯入")}
          </button>
        </div>
        <button type="button" id="exportCurrent" className={buttonClass} onClick={exportCurrent}>
          {t("只匯出目前設計")}
        </button>
        <input ref={file} type="file" id="importFile" accept="application/json,.json" multiple hidden onChange={(e) => void importFiles(e.target.files)} />
      </div>
      <p id="designsMsg" aria-live="polite" className="m-0 min-h-lh text-xs leading-snug text-muted">
        {msg}
      </p>
    </Panel>
  );
}
