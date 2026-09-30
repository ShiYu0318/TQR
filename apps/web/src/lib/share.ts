// Share links, saved settings and settings files, all in one versioned format (v1). The hash is a bare token
// (#s1.<base64url JSON>) so it survives hosts that only keep plain #anchors.
import { live } from "@/three/live";
import { useStudio, type Content, type Design, type Look, type Model, type Shape } from "@/store";
import type { Level, Mode } from "@tqr/tri-core";
import { CONTENT_TYPES, type Values } from "./content";
import { LOGO_FONTS, type CenterLogo } from "./centerLogo";
import type { LogoKind } from "./sideLogo";
import { BACKDROPS, GRADIENTS, PIECE_PALETTES, THEMES, type Colors } from "@/three/palette";

/** camera position of a shared view: azimuth and elevation in degrees, distance in cm */
export interface SharedView {
  az: number;
  el: number;
  cm: number;
}

export interface SavedState {
  v: 1;
  model: Model;
  mode: Mode;
  content: { t: string; f: Values }[];
  ec: Level;
  ver: string;
  logo: { k: LogoKind; txt: string; badge: boolean; lb: number };
  method: Design["method"];
  relaxed: boolean;
  budget: number;
  strut: number;
  look: Look;
  bg: string;
  floor: boolean;
  shape: Shape;
  theme: string;
  mod: Record<Model, number>;
  clogo: Omit<CenterLogo, "image"> & { img: { s: number; b: string } | null };
  colors: {
    model: string; finder: string; dark: string; light: string; base: string; bridge: string; strut: string; main: string;
    pal: string; fill: Colors["fill"]; grad: string; gradA: string; gradB: string; gradDir: Colors["gradDir"];
  };
  /** where the camera looks from, when the link was shared with its view */
  view?: SharedView;
}

/** the settings on screen; with `withView`, also where the camera looks from */
export function getState(withView = false): SavedState {
  const { model, design: d, look: l, moduleMm, camera } = useStudio.getState(), c = l.colors, { image, ...clogo } = d.centerLogo;
  const view = withView ? { view: { az: +live.azimuth.toFixed(1), el: +live.elevation.toFixed(1), cm: Math.round(camera.distanceCm) } } : {};
  return {
    v: 1, model, mode: d.mode, content: d.content.map((x) => ({ t: x.type, f: x.fields })), ec: d.level, ver: String(d.version),
    logo: { k: d.sideLogo.kind, txt: d.sideLogo.text, badge: d.sideLogo.badge, lb: d.sideLogo.budget },
    method: d.method, relaxed: d.relaxed, budget: d.budget, strut: d.strut, look: l.look, bg: l.backdrop, floor: l.floor, shape: l.shape,
    theme: l.theme, mod: { ...moduleMm },
    clogo: { ...clogo, views: [...clogo.views], img: image ? { s: image.size, b: image.bits.join("") } : null },
    colors: {
      model: c.model, finder: c.finder, dark: c.dark, light: c.light, base: c.base, bridge: c.bridge, strut: c.strut, main: c.main,
      pal: c.palette, fill: c.fill, grad: c.gradient, gradA: c.gradA, gradB: c.gradB, gradDir: c.gradDir,
    },
    ...view,
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
const oneOf = <T>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && v >= lo && v <= hi ? v : fallback);

/** apply saved settings; anything missing or unknown keeps its current value. Throws on something that is not v1 settings. */
export function setState(s: Partial<SavedState> | null | undefined) {
  if (!s || s.v !== 1 || !Array.isArray(s.content)) throw new Error("bad settings");
  const st = useStudio.getState(), d = st.design, l = st.look;
  const content = [...d.content] as Design["content"];
  s.content.slice(0, 3).forEach((c, i) => {
    if (c && CONTENT_TYPES[c.t]) content[i] = { type: c.t, fields: { ...c.f } } satisfies Content;
  });
  const lg = s.logo, L = s.clogo;
  const design: Design = {
    ...d,
    content,
    mode: oneOf(s.mode, ["3qr", "2qr_wall", "2qr_logo"] as Mode[], "3qr"),
    level: oneOf(s.ec, ["L", "M", "Q", "H"] as Level[], d.level),
    version: num(Number(s.ver), 0, 10, d.version),
    method: oneOf(s.method, ["bridge+strut", "bridge", "strut", "free", "dust"] as Design["method"][], d.method),
    relaxed: !!s.relaxed,
    budget: num(s.budget, 20, 100, d.budget),
    strut: num(s.strut, 10, 30, d.strut),
    sideLogo: lg
      ? { kind: oneOf(lg.k, ["heart", "star", "ring", "text"] as LogoKind[], d.sideLogo.kind), text: lg.txt ?? "", badge: !!lg.badge, budget: num(lg.lb, 0, 30, d.sideLogo.budget) }
      : d.sideLogo,
    centerLogo: L
      ? {
          kind: oneOf(L.kind, ["none", "text", "image"] as CenterLogo["kind"][], d.centerLogo.kind),
          text: L.text ?? "",
          font: oneOf(L.font, Object.keys(LOGO_FONTS) as CenterLogo["font"][], d.centerLogo.font),
          style: oneOf(L.style, ["box", "bar", "outline", "clear"] as CenterLogo["style"][], d.centerLogo.style),
          size: num(L.size, 1, 99, d.centerLogo.size),
          margin: num(L.margin, 0, 10, d.centerLogo.margin),
          dx: num(L.dx, -99, 99, d.centerLogo.dx),
          dy: num(L.dy, -99, 99, d.centerLogo.dy),
          views: (L.views ?? []).filter((v) => v === 0 || v === 1 || v === 2),
          image: L.img && /^[01]+$/.test(L.img.b) ? { size: L.img.s, bits: L.img.b.split("").map(Number) } : null,
        }
      : d.centerLogo,
  };
  const colors: Colors = { ...l.colors };
  const sc = s.colors;
  if (sc) {
    (["model", "finder", "dark", "light", "base", "bridge", "strut", "main", "gradA", "gradB"] as const).forEach((k) => {
      if (HEX.test(sc[k] ?? "")) colors[k] = sc[k];
    });
    if (PIECE_PALETTES[sc.pal]) colors.palette = sc.pal;
    colors.fill = oneOf(sc.fill, ["solid", "gradient"] as Colors["fill"][], colors.fill);
    if (sc.grad === "custom" || GRADIENTS[sc.grad]) colors.gradient = sc.grad;
    colors.gradDir = oneOf(sc.gradDir, ["up", "lr", "fb", "diag"] as Colors["gradDir"][], colors.gradDir);
  }
  st.setDesign(design);
  st.setLook({
    colors,
    look: oneOf(s.look, ["sil", "real", "solid", "pieces"] as Look[], l.look),
    shape: oneOf(s.shape, ["cube", "rounded", "cylinder", "sphere"] as Shape[], l.shape),
    theme: s.theme === "custom" || (s.theme && THEMES[s.theme]) ? s.theme : l.theme,
    backdrop: s.bg && BACKDROPS[s.bg] ? s.bg : l.backdrop,
    floor: typeof s.floor === "boolean" ? s.floor : l.floor,
  });
  if (s.mod) (["sil", "tile"] as Model[]).forEach((k) => {
    const v = Number(s.mod![k]);
    if (v >= 1 && v <= 20) st.setModuleMm(k, v);
  });
  if ((s.model === "sil" || s.model === "tile") && s.model !== st.model) st.setModel(s.model);
  const v = s.view;
  pendingView = v && [v.az, v.el, v.cm].every(Number.isFinite)
    ? { az: ((v.az % 360) + 360) % 360, el: Math.max(-90, Math.min(90, v.el)), cm: Math.max(10, Math.min(2000, v.cm)) }
    : null;
}

// a view that arrived with the settings, used once when the model is framed
let pendingView: SharedView | null = null;
export function takePendingView(): SharedView | null {
  const v = pendingView;
  pendingView = null;
  return v;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
export const encodeState = (s: SavedState) => "s1." + b64url(new TextEncoder().encode(JSON.stringify(s)));
export const decodeState = (tok: string): SavedState => JSON.parse(new TextDecoder().decode(unb64url(tok.slice(3))));

// s2 links: the same JSON, deflated first, so a link is about half as long. s1 links still open.
async function squeeze(bytes: Uint8Array, way: "in" | "out"): Promise<Uint8Array> {
  const stream = way === "in" ? new CompressionStream("deflate") : new DecompressionStream("deflate");
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encodeShare(s: SavedState): Promise<string> {
  if (typeof CompressionStream === "undefined") return encodeState(s);
  return "s2." + b64url(await squeeze(new TextEncoder().encode(JSON.stringify(s)), "in"));
}

export async function decodeShare(token: string): Promise<SavedState> {
  if (token.startsWith("s1.")) return decodeState(token);
  if (token.startsWith("s2.")) return JSON.parse(new TextDecoder().decode(await squeeze(unb64url(token.slice(3)), "out")));
  throw new Error("not a share token");
}

/** a link to this page that opens the settings on screen (and the camera view, with `withView`) */
export async function shareLink(withView = false): Promise<string> {
  return location.href.split("#")[0] + "#" + (await encodeShare(getState(withView)));
}

/** open a shared link: restore its settings before the first generation; returns what to tell the viewer */
export async function applySharedHash(): Promise<string> {
  const h = location.hash.slice(1);
  if (!h.startsWith("s1.") && !h.startsWith("s2.")) return "";
  // applied once: later edits are the viewer's own draft, so a reload must not bring the link back
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    /* some hosts refuse; harmless */
  }
  try {
    setState(await decodeShare(h));
    return "已套用分享連結的設定。";
  } catch {
    return "分享連結無法讀取，改用預設值。";
  }
}
