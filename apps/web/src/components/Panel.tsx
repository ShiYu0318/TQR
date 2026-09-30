import * as Collapsible from "@radix-ui/react-collapsible";
import type { ReactNode } from "react";
import { useStudio } from "@/store";
import { t, useT } from "@/i18n";
import { Info } from "./Info";

interface Props {
  id: string;
  title: string;
  /** which column: the fold chevron sits on the outer edge (left column on the left, right column mirrored) */
  side: "left" | "right";
  children: ReactNode;
  hidden?: boolean;
}

/**
 * A foldable settings panel. Closed, the chevron points into the page (right / left); open, it points down.
 * Every panel starts closed when the page opens.
 */
export function Panel({ id, title, side, children, hidden }: Props) {
  const open = useStudio((s) => s.panels[id] ?? false);
  const setPanel = useStudio((s) => s.setPanel);
  useT();
  if (hidden) return null;
  const closedTurn = side === "left" ? "-rotate-45" : "rotate-135";
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(o) => setPanel(id, o)}
      className="panel shrink-0 rounded-lg border border-rule bg-panel px-(--px) py-2.5 [--bgap:7px] [--px:12px] data-[side=right]:pb-3.5 data-[side=right]:[--bgap:8px] data-[side=right]:[--px:16px]"
      data-side={side}
      id={`${id}Panel`}
    >
      <Collapsible.Trigger
        className={`relative -mx-(--px) block w-[calc(100%+2*var(--px))] cursor-pointer border-0 bg-transparent px-3 text-center font-display text-sm font-bold tracking-wide text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${open ? "border-b border-solid border-rule pb-1.5" : "pb-0"}`}
      >
        {t(title)}
        <span
          aria-hidden="true"
          className={`absolute top-1.5 size-1.75 border-r-2 border-b-2 border-muted transition-transform duration-150 motion-reduce:transition-none ${side === "left" ? "left-3" : "right-3"} ${open ? "top-0.5 rotate-45" : closedTurn}`}
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="mt-2.5 flex flex-col gap-(--bgap)">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

/** a small uppercase heading inside a panel */
export function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10.5px] tracking-widest text-muted uppercase">{children}</div>;
}

export function Note({ children, tone }: { children: ReactNode; tone?: "warn" | "bad" | "ok" }) {
  const color = tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "ok" ? "text-accent" : "text-muted";
  return <p className={`m-0 text-xs leading-snug ${color}`}>{children}</p>;
}

/**
 * label + control on one row; the label is translated here; `info` adds an explanation button. The label column fits
 * four Chinese characters and the button, or an English label ("Content type") and the button.
 */
export function Field({ label, htmlFor, children, inline = true, info }: { label: string; htmlFor?: string; children: ReactNode; inline?: boolean; info?: ReactNode }) {
  const en = useStudio((s) => s.lang === "en");
  const row = en ? "grid-cols-[7em_minmax(0,1fr)]" : "grid-cols-[5.2em_minmax(0,1fr)]";
  return (
    <div className={inline ? `grid ${row} items-center gap-2` : "flex flex-col gap-1"}>
      <Labelled info={info} topic={label}>
        <label htmlFor={htmlFor} className="text-[12.5px] text-muted">
          {t(label)}
        </label>
      </Labelled>
      {children}
    </div>
  );
}

/** a label followed by its (i) button when there is something to explain; the button stays outside the <label> */
export function Labelled({ children, info, topic, wide }: { children: ReactNode; info?: ReactNode; topic?: string; wide?: boolean }) {
  if (!info) return <>{children}</>;
  return (
    <span className="flex min-w-0 items-center gap-1">
      {children}
      <Info topic={topic} wide={wide}>{info}</Info>
    </span>
  );
}

/** shared look of text inputs and selects */
export const inputClass =
  "w-full rounded-md border border-rule bg-panel px-2 py-1.25 font-body text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** secondary button in the side panels */
export const buttonClass =
  "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-rule bg-sunk px-2.5 py-1.75 text-[13px] text-ink hover:border-muted disabled:cursor-default disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** 16-unit line icon for panel buttons */
export function PanelIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
