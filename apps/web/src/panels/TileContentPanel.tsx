import { useStudio } from "@/store";
import { TILE } from "@/lib/tile";
import { Note, Panel } from "@/components/Panel";
import { useT } from "@/i18n";

// the tile's five codes and the view each is read from (the sides 40° from above)
const ROWS: [key: keyof typeof TILE.links, name: string, azimuth: number, elevation: number][] = [
  ["T", "俯視", 0, 90], ["N", "北面", 0, 40], ["E", "東面", 90, 40], ["S", "南面", 180, 40], ["W", "西面", 270, 40],
];

/** QQR content: the demo tile's fixed links; a click turns the camera to that side. */
export function TileContentPanel() {
  const setCamera = useStudio((s) => s.setCamera);
  const requestView = useStudio((s) => s.requestView);
  const t = useT();
  return (
    <Panel id="content" title="內容" side="left">
      <div className="flex flex-col gap-1">
        <span className="text-[12.5px] text-muted">{t("各方向的內容（點一下轉到那個方向）")}</span>
        <div className="flex flex-col gap-[3px]" role="group" aria-label={t("各方向的內容")} id="tileViewList">
          {ROWS.map(([k, name, az, el]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setCamera({ spin: null });
                requestView(az, el, useStudio.getState().camera.distanceCm);
              }}
              className="grid cursor-pointer grid-cols-[2.4em_auto_minmax(0,1fr)] items-baseline gap-2 rounded-md border border-rule bg-sunk px-2 py-1 text-left text-[12.5px] text-muted hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <b className="font-semibold text-ink">{t(name)}</b>
              <span className="whitespace-nowrap text-accent">{t("網址")}</span>
              <span className="truncate font-mono text-[11.5px]">{TILE.links[k]}</span>
            </button>
          ))}
        </div>
      </div>
      <Note>{t("QQR 目前是固定的示範模型，五個連結已經做在模型裡。要換成自己的連結，需要等 QQR 產生器移植到網頁。")}</Note>
    </Panel>
  );
}
