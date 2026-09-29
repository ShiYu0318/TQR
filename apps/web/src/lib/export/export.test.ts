// Export on synthetic shapes: box decomposition, welding, the file writers, the silhouette SVG and a real manifold
// union, so these run without any generated model.
import { describe, expect, it } from "vitest";
import { boxesFromMask, unionBoxes, weldMesh } from "./mesh";
import { crc32, stlBinary, zipStore } from "./formats";
import { silhouetteImage, silhouetteSvg } from "./twoD";

// an L-shaped plate with a hole and a separate post, in a 6×6×6 grid
const N = 6, idx = (x: number, y: number, z: number) => (x * N + y) * N + z;
const mask = new Uint8Array(N * N * N);
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) if (x < 2 || y < 2) mask[idx(x, y, 0)] = mask[idx(x, y, 1)] = 1;
mask[idx(0, 0, 0)] = 0;
for (let z = 0; z < 6; z++) mask[idx(5, 5, z)] = 1;

describe("mesh building blocks", () => {
  it("boxes cover exactly the mask", () => {
    const cover = new Uint8Array(mask.length);
    for (const [x0, y0, z0, x1, y1, z1] of boxesFromMask(mask, N, N, N))
      for (let a = x0; a < x1; a++) for (let b = y0; b < y1; b++) for (let c = z0; c < z1; c++) cover[idx(a, b, c)]++;
    expect(Array.from(cover)).toEqual(Array.from(mask));
  });
  it("merges boxes greedily along x, then y, then z", () => {
    const solid = new Uint8Array(8).fill(1);
    expect(boxesFromMask(solid, 2, 2, 2)).toEqual([[0, 0, 0, 2, 2, 2]]);
  });
  it("welds vertices at float32 positions and reports open edges", () => {
    // two triangles sharing an edge, one vertex repeated at a float32-equal position
    const vp = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1 + 1e-12, 0, 0, 1, 1, 0, 0, 1, 0];
    const m = weldMesh(vp, 3, [0, 1, 2, 3, 4, 5]);
    expect(m.verts.length).toBe(12);
    expect(Array.from(m.tris)).toEqual([0, 1, 2, 1, 3, 2]);
    expect(m.closed).toBe(false);
  });
});

describe("silhouettes", () => {
  it("the top view is drawn as seen from the top preset", () => {
    // n = 2 and a single voxel at x = 0, y = 1: top pixel (0, 1) lands at screen (x = 1, y = 1)
    const V = new Uint8Array(8);
    V[(0 * 2 + 1) * 2 + 0] = 1;
    const { n, S } = silhouetteImage({ n: 2, V }, 0);
    expect(n).toBe(2);
    expect(Array.from(S)).toEqual([0, 0, 0, 1]);
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
  it("the test shape comes out closed, in two pieces", async () => {
    const m = await unionBoxes(boxesFromMask(mask, N, N, N), 2);
    expect(m.closed).toBe(true);
    expect(m.pieces).toBe(2);
  }, 60_000);
});
