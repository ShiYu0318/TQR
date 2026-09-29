interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange(value: T): void;
  className?: string;
}

/** Two or more mutually exclusive buttons on a sunk track (aria-pressed), like the studio's .seg */
export function Segmented<T extends string>({ label, value, options, onChange, className = "" }: Props<T>) {
  return (
    <div role="group" aria-label={label} className={`grid grid-flow-col auto-cols-fr gap-0.75 rounded-md bg-sunk p-0.75 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="rounded border-0 bg-transparent px-1 py-1 text-xs font-semibold tracking-wide text-muted aria-pressed:bg-panel aria-pressed:text-ink aria-pressed:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
