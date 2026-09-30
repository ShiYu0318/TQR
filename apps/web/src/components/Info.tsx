import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { t } from "@/i18n";

/**
 * An (i) button that opens an explanation beside the control it belongs to, so the panels show only the controls until
 * someone asks why. `topic` (untranslated) names it for screen readers; `wide` suits longer texts.
 */
export function Info({ children, topic, wide }: { children: ReactNode; topic?: string; wide?: boolean }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label={topic ? t("說明：{x}", { x: t(topic) }) : t("說明")}
        className="inline-flex size-4.5 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent data-[state=open]:text-accent"
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <circle cx="8" cy="8" r="6.7" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="1" fill="currentColor" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={`z-50 flex max-h-[min(72vh,600px)] flex-col gap-2 overflow-y-auto rounded-lg border border-rule bg-panel px-3.5 py-3 font-body text-[12.5px] leading-relaxed text-ink shadow-[0_10px_28px_rgba(1,4,9,.65)] focus-visible:outline-none ${wide ? "w-[min(460px,calc(100vw-24px))]" : "w-[min(300px,calc(100vw-24px))]"} [&_b]:font-semibold [&_h3]:m-0 [&_h3]:mt-1 [&_h3]:font-display [&_h3]:text-[13px] [&_h3]:font-bold [&_p]:m-0`}
        >
          {children}
          <Popover.Arrow className="fill-rule" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** a term and its explanation inside an Info: the name on its own line, then what it means */
export function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p>
      <b className="block text-ink">{name}</b>
      <span className="text-muted">{children}</span>
    </p>
  );
}
