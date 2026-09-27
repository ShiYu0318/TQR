// The ES-module view must be the very solver tests/jstest.js checks: same codeword maps as Python for every version
// and level in the fixtures, and a generated sculpture whose views are all certified.
import { describe, expect, it } from "vitest";
import TRI from "../index.js";
import ref from "../../../tests/fixtures/js_ref.json";
import levels from "../../../tests/fixtures/js_ref_levels.json";

const same = (a, b) => a.length === b.length && Array.from(a).every((x, i) => x === b[i]);

describe("structure matches Python", () => {
  for (const [v, R] of Object.entries(ref.struct)) {
    it(`version ${v}, level H`, () => {
      const S = TRI.structure(+v, "H");
      expect(same(S.func, R.func)).toBe(true);
      expect(same(S.cw, R.cw)).toBe(true);
      expect(same(S.blk, R.blk)).toBe(true);
      expect(same(S.cap, R.cap)).toBe(true);
      expect(same(S.fclass, R.fclass)).toBe(true);
    });
  }
  it("every error-correction level in the fixture", () => {
    const bad = Object.entries(levels).filter(([key, R]) => {
      const S = TRI.structure(+key.slice(0, -1), key.slice(-1));
      return !(same(S.cw, R.cw) && same(S.blk, R.blk) && same(S.cap, R.cap));
    });
    expect(bad.map(([k]) => k)).toEqual([]);
  });
});

describe("generate", () => {
  it("certifies every view of a bridge+strut sculpture from the Python demo matrices", () => {
    const qr = ref.demo.qr.map((m) => Uint8Array.from(m));
    const r = TRI.generate({ qr, version: ref.demo.version, level: "H", mode: "3qr", method: "bridge+strut", budget: 0.5 });
    expect(r.n).toBe(17 + 4 * ref.demo.version);
    expect(r.kinds).toEqual(["qr", "qr", "qr"]);
    expect(r.evals.every((e) => e.ok)).toBe(true);
    expect(r.onePiece).toBe(true);
  });
});
