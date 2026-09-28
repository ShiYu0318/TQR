// File writers: binary STL, OBJ and 3MF (a stored ZIP with one object made of coloured parts).
import type { Mesh } from "./mesh";

export function stlBinary(mesh: Pick<Mesh, "verts" | "tris">): Blob {
  const nt = mesh.tris.length / 3, buf = new ArrayBuffer(84 + 50 * nt), dv = new DataView(buf), V = mesh.verts;
  dv.setUint32(80, nt, true);
  for (let i = 0, o = 84; i < nt; i++, o += 50) {
    const [a, b, c] = [mesh.tris[3 * i], mesh.tris[3 * i + 1], mesh.tris[3 * i + 2]].map((j) => [V[3 * j], V[3 * j + 1], V[3 * j + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], l = Math.hypot(nx, ny, nz) || 1;
    [nx / l, ny / l, nz / l, ...a, ...b, ...c].forEach((x, j) => dv.setFloat32(o + 4 * j, x, true));
  }
  return new Blob([buf], { type: "model/stl" });
}

export function objText(meshes: { name: string; mesh: Pick<Mesh, "verts" | "tris"> }[]): Blob {
  const L = ["# TQR Studio export (mm)"];
  let base = 0;
  for (const { name, mesh } of meshes) {
    L.push("o " + name);
    for (let i = 0; i < mesh.verts.length; i += 3) L.push(`v ${mesh.verts[i].toFixed(6)} ${mesh.verts[i + 1].toFixed(6)} ${mesh.verts[i + 2].toFixed(6)}`);
    for (let i = 0; i < mesh.tris.length; i += 3) L.push(`f ${mesh.tris[i] + 1 + base} ${mesh.tris[i + 1] + 1 + base} ${mesh.tris[i + 2] + 1 + base}`);
    base += mesh.verts.length / 3;
  }
  return new Blob([L.join("\n") + "\n"], { type: "text/plain" });
}

// ---- minimal ZIP (stored, no compression) for 3MF
const CRC_TABLE = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tb[n] = c >>> 0;
  }
  return tb;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[], type = "application/zip"): Blob {
  const enc = new TextEncoder(), chunks: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, f.data.length, true);
    h.setUint32(22, f.data.length, true);
    h.setUint16(26, nm.length, true);
    chunks.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, nm.length, true);
    c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + f.data.length;
  }
  const size = central.reduce((s, a) => s + a.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, off, true);
  return new Blob([...chunks, ...central, new Uint8Array(e.buffer)] as BlobPart[], { type });
}

/** one object made of coloured parts (multi-material slicers import them as parts of one object) */
export function threeMF(meshes: { name: string; color: string; mesh: Pick<Mesh, "verts" | "tris"> }[]): Blob {
  const enc = new TextEncoder(), col = (c: string) => c.toUpperCase() + "FF";
  const mats = meshes.map((m) => `<base name="${m.name}" displaycolor="${col(m.color)}"/>`).join("");
  const objs = meshes
    .map((m, i) => {
      const v: string[] = [], tr: string[] = [];
      for (let j = 0; j < m.mesh.verts.length; j += 3)
        v.push(`<vertex x="${m.mesh.verts[j].toFixed(6)}" y="${m.mesh.verts[j + 1].toFixed(6)}" z="${m.mesh.verts[j + 2].toFixed(6)}"/>`);
      for (let j = 0; j < m.mesh.tris.length; j += 3) tr.push(`<triangle v1="${m.mesh.tris[j]}" v2="${m.mesh.tris[j + 1]}" v3="${m.mesh.tris[j + 2]}"/>`);
      return `<object id="${i + 2}" name="${m.name}" type="model" pid="1" pindex="${i}"><mesh><vertices>${v.join("")}</vertices><triangles>${tr.join("")}</triangles></mesh></object>`;
    })
    .join("");
  const comps = meshes.map((_, i) => `<component objectid="${i + 2}"/>`).join(""), top = meshes.length + 2;
  const model =
    '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    `<resources><basematerials id="1">${mats}</basematerials>${objs}<object id="${top}" name="tqr" type="model"><components>${comps}</components></object></resources>` +
    `<build><item objectid="${top}"/></build></model>`;
  return zipStore(
    [
      { name: "[Content_Types].xml", data: enc.encode('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>') },
      { name: "_rels/.rels", data: enc.encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>') },
      { name: "3D/3dmodel.model", data: enc.encode(model) },
    ],
    "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  );
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
