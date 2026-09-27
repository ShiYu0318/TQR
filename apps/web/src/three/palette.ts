// Colour tables shared by the 3D view and the appearance panel; values match reference.html.

export interface Backdrop {
  /** sky gradient stops, top to bottom */
  sky: [number, string][];
  /** floor colour "r,g,b" */
  floor: string;
  /** contact-shadow strength 0..1 */
  shadow: number;
  grid?: string;
  /** red X / green Y axis lines through the middle of the floor */
  axes?: boolean;
}

/** listed from light to dark (by the mean luminance of sky and floor) */
export const BACKDROPS: Record<string, Backdrop> = {
  paper: { sky: [[0, "#ffffff"], [0.7, "#f5f4f0"], [1, "#e9e7e1"]], floor: "242,240,235", shadow: 0.28 },
  studio: { sky: [[0, "#f3f5f7"], [0.6, "#dde1e5"], [1, "#c6ccd2"]], floor: "214,218,223", shadow: 0.38 },
  lightgrey: { sky: [[0, "#b9bdc2"], [0.6, "#a9aeb4"], [1, "#989ea5"]], floor: "172,177,183", shadow: 0.36 },
  sunset: { sky: [[0, "#2a1b3d"], [0.55, "#6b2f5b"], [1, "#d9774b"]], floor: "104,50,70", shadow: 0.5 },
  blueprint: { sky: [[0, "#11528a"], [1, "#082a4a"]], floor: "16,70,120", shadow: 0.45, grid: "rgba(170,215,255,.4)" },
  blender: { sky: [[0, "#3d3d3d"], [1, "#3d3d3d"]], floor: "61,61,61", shadow: 0.35, grid: "rgba(255,255,255,.09)", axes: true },
  forest: { sky: [[0, "#2d4a3e"], [0.6, "#1a2e27"], [1, "#0e1a16"]], floor: "36,60,50", shadow: 0.55 },
  midnight: { sky: [[0, "#243b6b"], [0.6, "#111a33"], [1, "#070b16"]], floor: "28,42,74", shadow: 0.55 },
  graphite: { sky: [[0, "#30363d"], [0.55, "#1c2128"], [1, "#0d1117"]], floor: "40,46,54", shadow: 0.55 },
  black: { sky: [[0, "#1b1b1b"], [0.5, "#0a0a0a"], [1, "#000000"]], floor: "24,24,24", shadow: 0.6 },
};

export const BACKDROP_NAMES: Record<string, string> = {
  paper: "無接縫白紙", studio: "明亮攝影棚", lightgrey: "淺灰", sunset: "暮光", blueprint: "藍圖格線",
  blender: "Blender 風格", forest: "森林綠", midnight: "午夜藍", graphite: "石墨深灰", black: "純黑",
};

export const PIECE_PALETTES: Record<string, number[]> = {
  default: [0x2e7d6b, 0xc0653a, 0x4c6fb5, 0xb0892e, 0x8e4c9e, 0x3d8fb3, 0xa8412e, 0x5e8c3a],
  rainbow: [0xe5484d, 0xf76b15, 0xffc53d, 0x46a758, 0x12a594, 0x0090ff, 0x3e63dd, 0x8e4ec6],
  pastel: [0xf4a7b9, 0xf9c98c, 0xf6e58d, 0xa8e6cf, 0x9ed9f5, 0xb5b9f5, 0xd7b4f3, 0xf5b7e0],
  neon: [0xff2e88, 0x00f0ff, 0xb6ff00, 0xffb800, 0x9d4dff, 0x00ff9c, 0xff5c00, 0x2e6bff],
  warm: [0xb23a48, 0xe07a5f, 0xf2a541, 0xd4a373, 0x9c6644, 0xe63946, 0xf4845f, 0xc9184a],
  cool: [0x264653, 0x2a9d8f, 0x4ea8de, 0x5e60ce, 0x48bfe3, 0x7400b8, 0x56cfe1, 0x6930c3],
  github: [0x2f81f7, 0x3fb950, 0xd29922, 0xf85149, 0xa371f7, 0xdb61a2, 0x39c5cf, 0xf0883e],
};

/** the largest piece and the struts that go with each palette */
export const PALETTE_BASE: Record<string, { main: string; strut: string }> = {
  default: { main: "#3e4a45", strut: "#c98b2e" }, rainbow: { main: "#2b2f36", strut: "#c9ccd1" },
  pastel: { main: "#d9d3e6", strut: "#9c8fb8" }, neon: { main: "#1a1a2e", strut: "#f5f5f5" },
  warm: { main: "#5a3e36", strut: "#e9c46a" }, cool: { main: "#1f2d3d", strut: "#9ad1d4" },
  github: { main: "#30363d", strut: "#8b949e" },
};

export const GRADIENTS: Record<string, string[]> = {
  ocean: ["#38bdf8", "#1e3a8a"], sunset: ["#fb923c", "#db2777", "#6d28d9"], aurora: ["#22d3ee", "#a3e635", "#8b5cf6"],
  fire: ["#fde047", "#f97316", "#b91c1c"], mint: ["#d1fae5", "#10b981"], candy: ["#f9a8d4", "#a5b4fc"],
  mono: ["#f5f5f5", "#404040"], github: ["#2f81f7", "#a371f7"],
};

/** quick styles: model / finder colours for the sculpture, dark / light filament for the tile */
export const THEMES: Record<string, { model: string; finder: string; dark: string; light: string; shape: string }> = {
  classic: { model: "#2b2f33", finder: "#2b2f33", dark: "#141615", light: "#eef0ee", shape: "cube" },
  cyan: { model: "#14b8a6", finder: "#0f766e", dark: "#0f766e", light: "#f0fdfa", shape: "rounded" },
  tech: { model: "#1f6feb", finder: "#0b3d91", dark: "#0b3d91", light: "#eef4ff", shape: "cube" },
  facebook: { model: "#1877f2", finder: "#0d4fb3", dark: "#1464d6", light: "#ffffff", shape: "cube" },
  whatsapp: { model: "#25d366", finder: "#075e54", dark: "#128c7e", light: "#ffffff", shape: "cube" },
  youtube: { model: "#ff0000", finder: "#b20710", dark: "#cc0000", light: "#ffffff", shape: "cube" },
  orange: { model: "#f97316", finder: "#c2410c", dark: "#c2410c", light: "#fff7ed", shape: "cube" },
};

export interface Colors {
  model: string;
  finder: string;
  /** structure look: legal cubes, bridge cubes, struts */
  base: string;
  bridge: string;
  strut: string;
  /** pieces look: the largest piece and the palette for the rest */
  main: string;
  palette: string;
  /** real look fill: one colour or a gradient */
  fill: "solid" | "gradient";
  gradient: string;
  gradA: string;
  gradB: string;
  gradDir: "up" | "lr" | "fb" | "diag";
  /** egg-crate filaments */
  dark: string;
  light: string;
}

export const DEFAULT_COLORS: Colors = {
  model: "#d9dee3", finder: "#d9dee3", base: "#3e4a45", bridge: "#1f9e86", strut: "#c98b2e", main: "#3e4a45",
  palette: "default", fill: "solid", gradient: "ocean", gradA: "#38bdf8", gradB: "#1e3a8a", gradDir: "up",
  dark: "#141615", light: "#eef0ee",
};
