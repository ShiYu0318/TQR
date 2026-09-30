import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/store";
import { Labelled, Note, Panel, PanelIcon, buttonClass, inputClass } from "@/components/Panel";
import { shareLink } from "@/lib/share";
import { qrSvg } from "@/lib/qr";
import { saveBlob } from "@/lib/export/formats";
import { shareCard } from "@/lib/shareCard";
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
  const qr = useMemo(() => (link ? qrSvg(link) : null), [link]);
  // a link to this computer (a local preview) opens nowhere else
  const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname);

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

  const saveCard = async () => {
    const text = stale ? await fresh() : link;
    saveBlob(await shareCard(text), "tqr-share.png");
    setMsg(t("已下載分享圖卡 tqr-share.png。"));
  };
  // the system share sheet (phones, some desktops): the card and the link together when files can be shared
  const canShare = typeof navigator.share === "function";
  const systemShare = async () => {
    const url = stale ? await fresh() : link;
    try {
      const data: ShareData = { title: "TQR Studio", text: t("用 TQR Studio 做的多視角 QR 設計"), url };
      const card = new File([await shareCard(url)], "tqr-share.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [card] })) data.files = [card];
      await navigator.share(data);
      setMsg(t("已交給系統的分享選單。"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg(t("無法開啟系統的分享選單，可以改用複製連結。"));
    }
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
      <div className="flex gap-2">
        <button type="button" id="shareCard" className={buttonClass} onClick={() => void saveCard()}>
          {t("下載分享圖卡")}
        </button>
        {canShare && (
          <button type="button" id="shareSystem" className={buttonClass} onClick={() => void systemShare()}>
            {t("分享…")}
          </button>
        )}
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
        <input type="checkbox" id="shareView" className="mt-0.5 accent-accent" checked={withView} onChange={(e) => setWithView(e.target.checked)} />
        {t("連結帶上目前的視角")}
      </label>
      {qr ? (
        <div className="flex flex-col items-center gap-2" id="shareQr">
          <Labelled topic="分享連結的 QR 碼" info={<p>{t("用手機掃描就能打開這個設計。")}</p>}>
            <span className="text-[12.5px] text-muted">{t("分享連結的 QR 碼")}</span>
          </Labelled>
          <img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr.svg)} alt={t("分享連結的 QR 碼")} className="aspect-square w-full max-w-65 rounded bg-white [image-rendering:pixelated]" />
          <div className="flex w-full flex-col gap-1.5">
            {local && <Note tone="warn">{t("目前的網址只在這台電腦有效，手機掃了打不開；放上網站後再分享。")}</Note>}
            <button type="button" id="shareQrDownload" className={buttonClass} onClick={() => saveBlob(new Blob([qr.svg], { type: "image/svg+xml" }), "tqr-share-qr.svg")}>
              {t("下載 QR 碼")}
            </button>
          </div>
        </div>
      ) : (
        link && <Note>{t("連結太長，放不進 QR 碼。")}</Note>
      )}
      {shown && <input ref={urlBox} type="text" id="shareUrl" readOnly value={shown} aria-label={t("分享連結")} className={`${inputClass} font-mono text-[11.5px]`} onFocus={(e) => e.target.select()} />}
      <p id="shareMsg" aria-live="polite" className="m-0 min-h-lh text-xs leading-snug text-muted">
        {msg}
      </p>
    </Panel>
  );
}
