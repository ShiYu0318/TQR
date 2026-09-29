import { useStudio } from "@/store";
import { Segmented } from "./Segmented";
import { useT } from "@/i18n";
import mark from "../../../../assets/brand/logo.svg";
import wordmark from "../../../../assets/brand/wordmark-on-dark.svg";

const MODEL_NOTE = {
  sil: "背光看剪影。上、前、側三個方向各一個碼（或 Logo），對面看到的是鏡像。需要把相機拉遠，數公尺外用長焦掃。",
  tile: "平放在桌上。從正上方看讀到俯視的碼；站到北、東、南、西任一邊，往下斜 35-50° 讀到那一邊的碼。",
} as const;

export function Header() {
  const lang = useStudio((s) => s.lang);
  const model = useStudio((s) => s.model);
  const setLang = useStudio((s) => s.setLang);
  const setModel = useStudio((s) => s.setModel);
  const t = useT();
  return (
    <header className="area-top grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3.5 gap-y-2 max-[900px]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-[22px] leading-tight tracking-tight">
          <img src={mark} alt="" width={36} height={36} className="flex-none" />
          {/* 27 px = 9 modules of 3 px, so the pixel letters stay sharp; the Q's tail hangs below the caps */}
          <img src={wordmark} alt="TQR" width={57} height={27} className="flex-none translate-y-0.75 [image-rendering:pixelated]" />
          <span className="font-medium text-muted">Studio</span>
          <small className="font-body text-sm font-medium tracking-normal text-muted">{t("多視角 QR 設計工作室")}</small>
        </h1>
        <p className="m-0 text-sm text-muted">
          <span>{t("拖曳旋轉模型。畫面停下來時，瀏覽器會讀一次目前的畫面，告訴你這個角度掃得到哪個連結。剪影雕塑可以輸入任何連結即時產生，並切換各種連接方式比較。")}</span>{" "}
          <span>{t(MODEL_NOTE[model])}</span>
        </p>
      </div>
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
