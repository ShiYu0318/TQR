import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/store";
import { Panel, PanelIcon, buttonClass, inputClass } from "@/components/Panel";
import { shareLink } from "@/lib/share";
import { live, subscribeLive } from "@/three/live";
import { t, useT } from "@/i18n";

/** set by main.tsx when the page opened on a shared link */
export const sharedNote = { text: "" };

/**
 * The link for the design on screen, kept ready (compressing takes a moment) so a click can copy it at once: browsers
 * only allow writing to the clipboard straight from the click. With `withView` it follows the camera too. `stale` is
 * true while a change has not reached the link yet; `fresh()` computes it right away.
 */
export function useShareLink(withView: boolean) {
  const [state, setState] = useState({ link: "", stale: true });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined, alive = true, lastView = "";
    const later = (ms: number) => {
      clearTimeout(timer);
      setState((s) => (s.stale ? s : { ...s, stale: true }));
      timer = setTimeout(() => void shareLink(withView).then((link) => alive && setState({ link, stale: false })), ms);
    };
    later(0);
    const stopStore = useStudio.subscribe((s, p) => {
      if (s.design !== p.design || s.look !== p.look || s.model !== p.model || s.moduleMm !== p.moduleMm || (withView && s.camera !== p.camera)) later(250);
    });
    // the 3D view reports every frame, moving or not: only a changed angle counts
    const stopCamera = withView
      ? subscribeLive(() => {
          const view = live.azimuth.toFixed(1) + "," + live.elevation.toFixed(1);
          if (view !== lastView) (lastView = view), later(300);
        })
      : () => {};
    return () => {
      alive = false;
      clearTimeout(timer);
      stopStore();
      stopCamera();
    };
  }, [withView]);
  return { ...state, fresh: () => shareLink(withView) };
}

/** Hand the design to someone else: a link that opens it. */
export function SharePanel() {
  useT();
  const [msg, setMsg] = useState(() => (sharedNote.text ? t(sharedNote.text) : ""));
  const [withView, setWithView] = useState(false);
  const [shown, setShown] = useState("");
  const { link, stale, fresh } = useShareLink(withView);
  const urlBox = useRef<HTMLInputElement>(null);

  const copy = async () => {
    // a link still catching up with the last edit is computed now; the clipboard may then refuse, so fall back to
    // showing the link to copy by hand
    const text = stale ? await fresh() : link;
    const fallback = () => {
      setMsg(t("連結已產生，可以從這裡複製："));
      setShown(text);
      requestAnimationFrame(() => urlBox.current?.select());
    };
    if (!text) return;
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(text).then(() => {
        setMsg(t("已複製分享連結（{n} 字元）。", { n: text.length }));
        setShown("");
      }, fallback);
    else fallback();
  };

  return (
    <Panel id="share" title="分享" side="right">
      <button type="button" id="shareBtn" className={buttonClass} onClick={() => void copy()}>
        <PanelIcon>
          <path d="M6.5 9.5 9.5 6.5" />
          <path d="M7 4.5 8.3 3.2a2.8 2.8 0 0 1 4 4L11 8.5" />
          <path d="M9 11.5 7.7 12.8a2.8 2.8 0 0 1-4-4L5 7.5" />
        </PanelIcon>
        <span>{t("複製分享連結")}</span>
      </button>
      <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
        <input type="checkbox" id="shareView" className="mt-0.5 accent-accent" checked={withView} onChange={(e) => setWithView(e.target.checked)} />
        {t("連結帶上目前的視角")}
      </label>
      {shown && <input ref={urlBox} type="text" id="shareUrl" readOnly value={shown} aria-label={t("分享連結")} className={`${inputClass} font-mono text-[11.5px]`} onFocus={(e) => e.target.select()} />}
      <p id="shareMsg" aria-live="polite" className="m-0 min-h-lh text-xs leading-snug text-muted">
        {msg}
      </p>
    </Panel>
  );
}
