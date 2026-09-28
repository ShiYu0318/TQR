// Share tokens must round-trip, and must stay readable by (and read) the reference app's own encoder.
import { describe, expect, it } from "vitest";
import { useStudio } from "@/store";
import { decodeState, encodeState, getState, setState, type SavedState } from "./share";
import { cut, studioSource } from "@/testing/studio";

const studio = studioSource
  ? (new Function(cut("const b64url", "function shareMsg") + "return {encodeState, decodeState};")() as {
      encodeState(s: object): string;
      decodeState(t: string): SavedState;
    })
  : null;

describe("share tokens", () => {
  it("round-trip the whole design, look and module sizes", () => {
    const st = useStudio.getState();
    st.setContent(1, { type: "wifi", fields: { ssid: "咖啡廳 Wi-Fi", password: "p@ss", enc: "WPA" } });
    st.setDesign({ mode: "2qr_logo", level: "Q", version: 4, method: "strut", strut: 25, relaxed: true });
    st.setDesign({ centerLogo: { ...st.design.centerLogo, kind: "image", views: [1], image: { size: 3, bits: [1, 0, 1, 0, 1, 0, 1, 0, 1] } } });
    st.setLook({ look: "pieces", shape: "rounded", backdrop: "paper", floor: false, colors: { ...st.look.colors, palette: "neon", fill: "gradient", gradDir: "diag", model: "#123456" } });
    st.setModuleMm("sil", 4.5);
    const before = getState(), tok = encodeState(before);
    expect(tok.startsWith("s1.")).toBe(true);
    expect(tok).toMatch(/^s1\.[A-Za-z0-9_-]+$/);
    expect(decodeState(tok)).toEqual(before);
    // reset, then apply
    useStudio.setState(useStudio.getInitialState());
    expect(getState()).not.toEqual(before);
    setState(decodeState(tok));
    expect(getState()).toEqual(before);
  });
  it.skipIf(!studio)("is the reference app's format", () => {
    const s = getState();
    expect(studio!.decodeState(encodeState(s))).toEqual(s);
    expect(decodeState(studio!.encodeState(s))).toEqual(s);
  });
  it("rejects what is not v1 settings and ignores unknown values", () => {
    expect(() => setState(null)).toThrow();
    expect(() => setState({ v: 2 } as never)).toThrow();
    const before = getState();
    setState({ v: 1, content: [{ t: "nope", f: {} }], mode: "5qr", ec: "X", bg: "nowhere", mod: { sil: 99, tile: 0 }, colors: { model: "red" } } as never);
    const after = getState();
    expect(after.content).toEqual(before.content);
    expect(after.mode).toBe("3qr");
    expect(after.ec).toBe(before.ec);
    expect(after.bg).toBe(before.bg);
    expect(after.mod).toEqual(before.mod);
    expect(after.colors.model).toBe(before.colors.model);
  });
});
