import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Level, Method, Mode, Result } from "@tqr/tri-core";

export type Lang = "zh" | "en";
export type Model = "sil" | "tile";
export type Look = "sil" | "real" | "solid" | "pieces";
export type Shape = "cube" | "rounded" | "cylinder" | "sphere";

/** one view's content: a content type (url, wifi, vcard, ...) and its fields */
export interface Content {
  type: string;
  fields: Record<string, string>;
}

export interface Design {
  mode: Mode;
  content: [Content, Content, Content];
  level: Level;
  /** 0 = the smallest version that fits */
  version: number;
  method: Method;
  relaxed: boolean;
  /** share of each block's capacity bridging may use, in % */
  budget: number;
  /** strut width as a share of a module, in % */
  strut: number;
}

export interface Look3D {
  look: Look;
  shape: Shape;
  theme: string;
  backdrop: string;
  floor: boolean;
}

export interface Camera {
  azimuth: number;
  elevation: number;
  distanceCm: number;
  spin: "v" | "h" | "free" | null;
  /** degrees per second */
  spinSpeed: number;
}

interface State {
  lang: Lang;
  model: Model;
  /** which settings panels are open, by panel id */
  panels: Record<string, boolean>;
  /** controls hidden from the 3D view */
  clean: boolean;
  design: Design;
  look: Look3D;
  camera: Camera;
  result: Result | null;
  busy: boolean;
  message: string;
  /** links that have lit since the last reset, per model */
  found: Record<Model, string[]>;

  setLang(lang: Lang): void;
  setModel(model: Model): void;
  setPanel(id: string, open: boolean): void;
  setClean(clean: boolean): void;
  setDesign(patch: Partial<Design>): void;
  setLook(patch: Partial<Look3D>): void;
  setCamera(patch: Partial<Camera>): void;
  setResult(result: Result | null): void;
  setBusy(busy: boolean, message?: string): void;
  markFound(model: Model, key: string): void;
  resetFound(model: Model): void;
}

const url = (u: string): Content => ({ type: "url", fields: { url: u } });

export const useStudio = create<State>()(
  persist(
    (set) => ({
      lang: "zh",
      model: "sil",
      panels: { content: true, structure: true, look: true, logo: false, output: true, share: true },
      clean: false,
      design: {
        mode: "3qr",
        content: [url("https://s.gd/aaa1"), url("https://s.gd/bbb2"), url("https://s.gd/ccc3")],
        level: "H",
        version: 0,
        method: "bridge+strut",
        relaxed: false,
        budget: 50,
        strut: 20,
      },
      look: { look: "sil", shape: "cube", theme: "custom", backdrop: "graphite", floor: true },
      camera: { azimuth: 0, elevation: 0, distanceCm: 600, spin: null, spinSpeed: 21 },
      result: null,
      busy: false,
      message: "",
      found: { sil: [], tile: [] },

      setLang: (lang) => set({ lang }),
      setModel: (model) => set({ model }),
      setPanel: (id, open) => set((s) => ({ panels: { ...s.panels, [id]: open } })),
      setClean: (clean) => set({ clean }),
      setDesign: (patch) => set((s) => ({ design: { ...s.design, ...patch } })),
      setLook: (patch) => set((s) => ({ look: { ...s.look, ...patch } })),
      setCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
      setResult: (result) => set({ result }),
      setBusy: (busy, message = "") => set({ busy, message }),
      markFound: (model, key) =>
        set((s) => (s.found[model].includes(key) ? s : { found: { ...s.found, [model]: [...s.found[model], key] } })),
      resetFound: (model) => set((s) => ({ found: { ...s.found, [model]: [] } })),
    }),
    {
      name: "tqr.studio",
      // per-viewer conveniences only; the design itself travels in share links and saved files
      partialize: (s) => ({ lang: s.lang, panels: s.panels, look: { backdrop: s.look.backdrop, floor: s.look.floor } }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<State>;
        return { ...current, ...p, look: { ...current.look, ...(p.look ?? {}) } };
      },
    },
  ),
);
