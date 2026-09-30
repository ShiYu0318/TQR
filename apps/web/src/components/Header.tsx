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
    </header>
  );
}
