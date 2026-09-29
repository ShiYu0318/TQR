// Stage button icons (24×24, stroke).
const base = { viewBox: "0 0 24 24", width: 17, height: 17, fill: "none", stroke: "currentColor", strokeWidth: 2,
               strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const ResetIcon = () => (
  <svg {...base}>
    <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.3" />
    <path d="M3 3v5.3h5.3" />
  </svg>
);

/** four arrows out to the corners; `inward` points them back to the centre */
export const FullscreenIcon = ({ inward }: { inward: boolean }) => (
  <svg {...base}>
    <path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
    <path d={inward ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"} />
  </svg>
);

export const EyeIcon = ({ off }: { off: boolean }) =>
  off ? (
    <svg {...base}>
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2" />
      <path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.5-.5 4.9-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  ) : (
    <svg {...base}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
