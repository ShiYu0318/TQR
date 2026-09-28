// Export must match the reference app: run the studio's own mesh and 2D functions against this port, then check the
// file writers and a real manifold union.
import { describe, expect, it } from "vitest";
import TRI, { type Result } from "@tqr/tri-core";
import ref from "../../../../../tests/fixtures/js_ref.json";
import { addStruts, boxesFromMask, sculptureMask, sculptureParts, unionBoxes, weldMesh } from "./mesh";
import { crc32, stlBinary, zipStore } from "./formats";
import { silhouetteImage, silhouetteSvg } from "./twoD";
import { cut, studioSource } from "@/testing/studio";

const studio = studioSource
  ? (new Function(
      cut("function boxesFromMask", "async function unionBoxes") +
        cut("function sculptureMask", "async function modelParts") +
        "return {boxesFromMask, weldMesh, sculptureMask, addStruts};",
    )() as {
      boxesFromMask: typeof boxesFromMask;
      weldMesh: typeof weldMesh;
      sculptureMask: typeof sculptureMask;
      addStruts: typeof addStruts;
    })
  : null;
// the studio reads the generated result from a global GEN
const studioSilhouette = (r: Result, view: number) =>
  new Function("GEN", cut("function silhouetteImage", "function qrExport") + "return silhouetteImage;")({ r })(view) as { n: number; S: Uint8Array };

const qr = ref.demo.qr.map((m) => Uint8Array.from(m));
const result = TRI.generate({ qr, version: ref.demo.version, level: "H", mode: "3qr", method: "bridge+strut", budget: 0.5 });

describe.skipIf(!studio)("mesh pipeline matches the reference app", () => {
  for (const k of [2, 4, 5]) {
    it(`fine mask, struts and boxes at k=${k}`, () => {
      const mine = sculptureMask(result, k), theirs = studio!.sculptureMask(result, k);
      addStruts(mine.F, mine.N, result, k);
      studio!.addStruts(theirs.F, theirs.N, result, k);
      expect(mine.N).toBe(theirs.N);
      expect(Buffer.from(mine.F).equals(Buffer.from(theirs.F))).toBe(true);
      expect(boxesFromMask(mine.F, mine.N, mine.N, mine.N)).toEqual(studio!.boxesFromMask(theirs.F, theirs.N, theirs.N, theirs.N));
    });
  }
  it("welds like the studio", () => {
    // two triangles sharing an edge, one vertex repeated at a float32-equal position
    const vp = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1 + 1e-12, 0, 0, 1, 1, 0, 0, 1, 0];
    const tv = [0, 1, 2, 3, 4, 5];
    const mine = weldMesh(vp, 3, tv), theirs = studio!.weldMesh(vp, 3, tv);
    expect(Array.from(mine.verts)).toEqual(Array.from(theirs.verts));
    expect(Array.from(mine.tris)).toEqual(Array.from(theirs.tris));
    expect(mine.verts.length).toBe(12);
    expect(mine.closed).toBe(false);
  });
  for (const view of [0, 1, 2])
    it(`silhouette of view ${view}`, () => {
      const mine = silhouetteImage(result, view), theirs = studioSilhouette(result, view);
      expect(mine.n).toBe(theirs.n);
      expect(Array.from(mine.S)).toEqual(Array.from(theirs.S));
    });
});

describe("silhouette is the QR it encodes", () => {
  it("boxes cover exactly the mask", () => {
    const { F, N } = sculptureMask(result, 2), cover = new Uint8Array(F.length);
    for (const [x0, y0, z0, x1, y1, z1] of boxesFromMask(F, N, N, N))
      for (let a = x0; a < x1; a++) for (let b = y0; b < y1; b++) for (let c = z0; c < z1; c++) cover[(a * N + b) * N + c]++;
    expect(Array.from(cover)).toEqual(Array.from(F));
  });
  it("the top view, turned back to QR orientation, is the demo matrix", () => {
    // top: screen x = n-1-row, screen y = col
    const { n, S } = silhouetteImage(result, 0), M = qr[0];
    let diff = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) diff += +(S[c * n + (n - 1 - r)] !== M[r * n + c]);
    expect(diff).toBeLessThan(n * n * 0.05); // bridges may flip a few data modules, within the error budget
  });
  it("svg has a quiet zone and one rect per run", () => {
    const svg = silhouetteSvg(3, Uint8Array.from([1, 1, 0, 0, 0, 0, 1, 0, 1]), 4);
    expect(svg).toContain('viewBox="0 0 11 11"');
    expect(svg.match(/<rect x=/g)!.length).toBe(3);
    expect(svg).toContain('<rect x="4" y="4" width="2" height="1"/>');
  });
});

describe("file writers", () => {
  it("crc32 of a known string", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("zip holds its files uncompressed with valid headers", async () => {
    const data = new TextEncoder().encode("hello"), zip = new Uint8Array(await zipStore([{ name: "a.txt", data }]).arrayBuffer());
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(14, true)).toBe(crc32(data));
    expect(new TextDecoder().decode(zip.slice(35, 40))).toBe("hello");
    const end = zip.length - 22;
    expect(dv.getUint32(end, true)).toBe(0x06054b50);
    expect(dv.getUint16(end + 10, true)).toBe(1);
    expect(dv.getUint32(dv.getUint32(end + 16, true), true)).toBe(0x02014b50);
  });
  it("binary stl stores the triangle count and unit normals", async () => {
    const mesh = { verts: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), tris: Uint32Array.from([0, 1, 2]) };
    const buf = await stlBinary(mesh).arrayBuffer(), dv = new DataView(buf);
    expect(buf.byteLength).toBe(84 + 50);
    expect(dv.getUint32(80, true)).toBe(1);
    expect([0, 1, 2].map((i) => dv.getFloat32(84 + 4 * i, true))).toEqual([0, 0, 1]);
  });
});

describe("manifold union (WebAssembly)", () => {
  it("two touching boxes fuse into one closed piece", async () => {
    const m = await unionBoxes([[0, 0, 0, 1, 1, 1], [1, 0, 0, 2, 1, 1]], 3);
    expect(m.closed).toBe(true);
    expect(m.pieces).toBe(1);
  });
  it("the demo sculpture's body is a closed mesh", async () => {
    const [body] = sculptureParts(result, 0.2, 3, new Set(), { model: "#fff", finder: "#000" });
    const m = await unionBoxes(body.boxes, body.scale);
    expect(m.closed).toBe(true);
    expect(m.pieces).toBe(1);
    expect(m.tris.length).toBeGreaterThan(1000);
  }, 60_000);
});
