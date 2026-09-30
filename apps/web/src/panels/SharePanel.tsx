import { useRef, useState } from "react";
import { Panel, PanelIcon, buttonClass, inputClass } from "@/components/Panel";
import { shareUrl } from "@/lib/share";
import { t, useT } from "@/i18n";

/** set by main.tsx when the page opened on a shared link */
export const sharedNote = { text: "" };

/** Hand the design to someone else: a link that opens it. */
export function SharePanel() {
  useT();
  const [msg, setMsg] = useState(() => (sharedNote.text ? t(sharedNote.text) : ""));
  const [url, setUrl] = useState<string | null>(null);
  const urlBox = useRef<HTMLInputElement>(null);

  const share = () => {
    const link = shareUrl();
    const show = () => {
      setMsg(t("連結已產生，可以從這裡複製："));
      setUrl(link);
      requestAnimationFrame(() => urlBox.current?.select());
    };
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(link).then(() => {
        setMsg(t("已複製分享連結（{n} 字元）。", { n: link.length }));
        setUrl(null);
      }, show);
    else show();
  };
  return (
    <Panel id="share" title="分享" side="right">
      <button type="button" id="shareBtn" className={buttonClass} onClick={share}>
        <PanelIcon>
          <path d="M6.5 9.5 9.5 6.5" />
          <path d="M7 4.5 8.3 3.2a2.8 2.8 0 0 1 4 4L11 8.5" />
          <path d="M9 11.5 7.7 12.8a2.8 2.8 0 0 1-4-4L5 7.5" />
        </PanelIcon>
        <span>{t("複製分享連結")}</span>
      </button>
      {url && <input ref={urlBox} type="text" id="shareUrl" readOnly value={url} aria-label={t("分享連結")} className={`${inputClass} font-mono text-[11.5px]`} onFocus={(e) => e.target.select()} />}
      <p id="shareMsg" aria-live="polite" className="m-0 min-h-lh text-xs leading-snug text-muted">
        {msg}
      </p>
    </Panel>
  );
}
