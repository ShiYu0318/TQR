import { useStudio } from "@/store";
import { Segmented } from "./Segmented";
import { useT } from "@/i18n";
import { Info, Term } from "./Info";
import mark from "../../../../assets/brand/logo.svg";
import wordmark from "../../../../assets/brand/wordmark-on-dark.svg";

export function Header() {
  const lang = useStudio((s) => s.lang);
  const model = useStudio((s) => s.model);
  const setLang = useStudio((s) => s.setLang);
  const setModel = useStudio((s) => s.setModel);
  const t = useT();
  return (
    <header className="area-top grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3.5 gap-y-2 max-[900px]:grid-cols-1">
      <h1 className="m-0 flex min-w-0 items-start gap-x-2.5 font-display leading-none">
        <img src={mark} alt="" width={36} height={36} className="flex-none" />
        {/* 27 px = 9 modules of 3 px, so the pixel letters stay sharp; the caps are the top 7 modules (21 px) and the
            Q's tail hangs below. "Studio" is sized and placed so its capitals match them: same height, same top and
            baseline. */}
        <span className="flex items-start gap-x-2 pt-1.5">
          <img src={wordmark} alt="TQR" width={57} height={27} className="flex-none [image-rendering:pixelated]" />
          <span className="-mt-(--studio-lift) text-(length:--studio-size) font-medium tracking-tight text-muted [--studio-lift:5px] [--studio-size:32px]">
            Studio
          </span>
          <span className="self-center pb-1.5">
            <Info topic="關於 TQR Studio" wide>
              <h3>{t("關於 TQR Studio")}</h3>
              <p>{t("TQR 設計的是實體物件：從不同方向看，會讀到不同的 QR 碼。這個工作室在瀏覽器裡完成整個流程：輸入連結、生成模型、轉動檢查、下載列印檔。")}</p>
              <h3>{t("兩種模型")}</h3>
              <Term name={t("TQR：剪影產生器")}>
                {t("一組方塊，從上、前、側三個方向看的剪影各是一個 QR 碼，也可以把其中一面換成牆或 Logo。要背光看剪影，對面看到的是鏡像；相機得拉遠，在數公尺外用長焦掃。")}
              </Term>
              <Term name={t("QQR：五向蛋格")}>
                {t("一片平放的板子，每個 QR 模組是一個開口的格子。格子四面牆各帶一個方向的碼，格底帶俯視的碼，所以一片能放五個碼。從正上方讀俯視的碼；站到北、東、南、西任一邊，往下斜 35° 到 50° 讀那一邊的碼。")}
              </Term>
              <h3>{t("怎麼做到的")}</h3>
              <p>{t("三個剪影的共同部分通常會碎成很多互不相連的小塊，印不出來。生成器只在 QR 糾錯能力容許的範圍內補上格體，把碎塊接成一件；被定位圖案封住、補不過去的地方，再加上細支架。")}</p>
              <p>{t("每個方向都會檢查：定位等功能圖案完全正確，而且每個區塊改動的碼字沒有超出糾錯上限，這個碼就有數學保證可以解碼。")}</p>
              <h3>{t("怎麼用")}</h3>
              <p>{t("左邊填內容、選結構，按「生成」。拖曳旋轉模型，畫面停下來時，瀏覽器會讀一次目前的畫面，告訴你這個角度掃得到哪個連結。右邊可以儲存設計、下載列印檔，或產生分享連結。")}</p>
            </Info>
          </span>
        </span>
      </h1>
      <div className="flex flex-wrap items-start justify-end gap-2 max-[900px]:justify-start">
        <div className="grid gap-1.5 max-[900px]:grid-flow-col max-[900px]:justify-start">
          <Segmented
            label={t("語言")}
            className="w-29"
            value={lang}
            onChange={setLang}
            options={[
              { value: "zh", label: "中文" },
              { value: "en", label: "EN" },
            ]}
          />
          <Segmented
            label={t("選擇模型")}
            className="w-29"
            value={model}
            onChange={setModel}
            options={[
              { value: "sil", label: "TQR", title: t("TQR：剪影產生器") },
              { value: "tile", label: "QQR", title: t("QQR：五向蛋格") },
            ]}
          />
        </div>
        <a
          href="https://github.com/ShiYu0318/TQR"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("在 GitHub 開啟原始碼")}
          title={t("在 GitHub 開啟原始碼")}
          className="inline-flex min-h-8 flex-none items-center gap-1.5 rounded-md border border-rule bg-sunk px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.543 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.023-.7.078-.686.078-.686 1.13.08 1.724 1.16 1.724 1.16 1.005 1.723 2.636 1.225 3.278.937.102-.728.393-1.225.715-1.507-2.499-.284-5.126-1.25-5.126-5.565 0-1.23.44-2.234 1.16-3.022-.116-.285-.503-1.43.11-2.981 0 0 .945-.303 3.094 1.154A10.8 10.8 0 0 1 12 6.224c.956.005 1.919.129 2.817.379 2.148-1.457 3.091-1.154 3.091-1.154.615 1.551.228 2.696.112 2.981.722.788 1.159 1.792 1.159 3.022 0 4.326-2.631 5.278-5.138 5.557.404.35.766 1.042.766 2.1 0 1.516-.014 2.74-.014 3.112 0 .302.203.653.774.542A11.252 11.252 0 0 0 12 .75Z" />
          </svg>
          GitHub
        </a>
      </div>
    </header>
  );
}
