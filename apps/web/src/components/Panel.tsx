import * as Collapsible from "@radix-ui/react-collapsible";
import type { ReactNode } from "react";
import { useStudio } from "@/store";
import { t, useT } from "@/i18n";

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
 * Open or closed is remembered per viewer (the store persists it).
 */
export function Panel({ id, title, side, children, hidden }: Props) {
  const open = useStudio((s) => s.panels[id] ?? true);
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

/** label + control on one row (5.2em label column); the label is translated here */
export function Field({ label, htmlFor, children, inline = true }: { label: string; htmlFor?: string; children: ReactNode; inline?: boolean }) {
  return (
    <div className={inline ? "grid grid-cols-[5.2em_minmax(0,1fr)] items-center gap-2" : "flex flex-col gap-1"}>
      <label htmlFor={htmlFor} className="text-[12.5px] text-muted">
        {t(label)}
      </label>
      {children}
    </div>
  );
}

/** shared look of text inputs and selects */
export const inputClass =
  "w-full rounded-md border border-rule bg-panel px-2 py-1.25 font-body text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
