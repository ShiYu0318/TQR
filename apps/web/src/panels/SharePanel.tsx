import { useRef, useState, type ReactNode } from "react";
import { Field, Label, Panel, inputClass } from "@/components/Panel";
import { saveBlob } from "@/lib/export/formats";
import { deleteSaved, getState, readSaved, saveCurrent, setState, shareUrl } from "@/lib/share";

/** set by main.tsx when the page opened on a shared link */
export const sharedNote = { text: "" };

const btn =
  "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-rule bg-sunk px-2.5 py-[7px] text-[13px] text-ink hover:border-muted disabled:cursor-default disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Copy a share link, keep settings in this browser, or move them as a JSON file. */
export function SharePanel() {
  const [msg, setMsg] = useState(sharedNote.text);
  const [url, setUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(readSaved);
  const [pick, setPick] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const urlBox = useRef<HTMLInputElement>(null);

  const share = () => {
    const link = shareUrl();
    const show = () => {
      setMsg("連結已產生，可以從這裡複製：");
      setUrl(link);
      requestAnimationFrame(() => urlBox.current?.select());
    };
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(link).then(() => {
        setMsg(`已複製分享連結（${link.length} 字元）。`);
        setUrl(null);
      }, show);
    else show();
  };
  const save = () => {
    if (saveCurrent()) {
      setSaved(readSaved());
      setPick(0);
      setMsg("已儲存到這個瀏覽器。");
    } else setMsg("這個瀏覽器不允許儲存（例如無痕模式）。可以改用匯出 JSON。");
  };
  const load = () => {
    const it = saved[pick];
    if (!it) return;
    try {
      setState(it.state);
      setMsg("已載入，按「生成」建立模型。");
    } catch {
      setMsg("這筆設定無法讀取。");
    }
  };
  const remove = () => {
    if (!saved[pick]) return;
    deleteSaved(pick);
    setSaved(readSaved());
    setPick(0);
    setMsg("已刪除。");
  };
  const exportJson = () => {
    saveBlob(new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" }), "tqr-settings.json");
    setMsg("已匯出 tqr-settings.json。");
  };
  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      setState(JSON.parse(await f.text()));
      setMsg("已匯入，按「生成」建立模型。");
    } catch {
      setMsg("這個檔案不是 TQR Studio 的設定檔。");
    }
    if (file.current) file.current.value = "";
  };

  return (
    <Panel id="share" title="分享與存檔" side="right">
      <div className="flex gap-2">
        <button type="button" id="shareBtn" className={btn} onClick={share}>
          <Icon>
            <path d="M6.5 9.5 9.5 6.5" />
            <path d="M7 4.5 8.3 3.2a2.8 2.8 0 0 1 4 4L11 8.5" />
            <path d="M9 11.5 7.7 12.8a2.8 2.8 0 0 1-4-4L5 7.5" />
          </Icon>
          <span>複製分享連結</span>
        </button>
        <button type="button" id="saveBtn" className={btn} onClick={save}>
          <Icon>
            <path d="M3 2.5h8l2.5 2.5v8.5h-10.5z" />
            <path d="M5.5 2.5v3h5v-3" />
            <rect x="5" y="9" width="6" height="4.5" />
          </Icon>
          <span>儲存到瀏覽器</span>
        </button>
      </div>
      {url && <input ref={urlBox} type="text" id="shareUrl" readOnly value={url} aria-label="分享連結" className={`${inputClass} font-mono text-[11.5px]`} onFocus={(e) => e.target.select()} />}
      <div className="flex flex-col gap-2 border-t border-rule pt-2.5">
        <Field label="已儲存的設定" htmlFor="savedSel" inline={false}>
          <select id="savedSel" className={inputClass} value={saved.length ? pick : ""} onChange={(e) => setPick(+e.target.value)}>
            {saved.length ? saved.map((it, i) => <option key={i} value={i}>{it.name}</option>) : <option value="">（還沒有儲存的設定）</option>}
          </select>
        </Field>
        <div className="flex gap-2">
          <button type="button" id="loadBtn" className={btn} disabled={!saved.length} onClick={load}>
            載入
          </button>
          <button type="button" id="delBtn" className={btn} disabled={!saved.length} onClick={remove}>
            刪除
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-rule pt-2.5">
        <Label>設定檔</Label>
        <div className="flex gap-2">
          <button type="button" id="exportBtn" className={btn} onClick={exportJson}>
            匯出 JSON
          </button>
          <button type="button" id="importBtn" className={btn} onClick={() => file.current?.click()}>
            匯入 JSON
          </button>
        </div>
        <input ref={file} type="file" id="importFile" accept="application/json,.json" hidden onChange={(e) => void importJson(e.target.files?.[0])} />
      </div>
      <p id="shareMsg" aria-live="polite" className="m-0 min-h-[1lh] text-xs leading-snug text-muted">
        {msg}
      </p>
    </Panel>
  );
}
