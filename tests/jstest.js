const TRI = require('../src/js/tri_core.js');
const ref = require('./fixtures/js_ref.json');
TRI.setTables(require('../src/js/qr_tables.json'));
let bad = 0;
for (const [v, R] of Object.entries(ref.struct)) {
  const S = TRI.structure(+v, 'H');
  const cmp = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const ok = cmp(Array.from(S.func), R.func) && cmp(Array.from(S.cw), R.cw) && cmp(Array.from(S.blk), R.blk) && cmp(Array.from(S.cap), R.cap) && cmp(Array.from(S.fclass), R.fclass);
  if (!ok) bad++;
  console.log(`v${v}: structure ${ok ? 'matches Python' : 'MISMATCH'}`);
}
const qr = ref.demo.qr.map(a => Uint8Array.from(a));
for (const [mode, method, relaxed] of [['3qr','dust',false],['3qr','strut',false],['3qr','bridge',false],['3qr','bridge+strut',false],['3qr','bridge',true],['3qr','free',false]]) {
  const r = TRI.generate({qr, version: ref.demo.version, level: 'H', mode, method, relaxed, budget: 0.5});
  console.log(mode, method + (relaxed ? '(relaxed)' : ''), `cubes=${r.cubes} struts=${r.struts} pieces=${r.pieces} main=${r.mainShare.toFixed(2)} cert=[${r.evals.map(e => e.ok)}] blocks=${JSON.stringify(r.evals.map(e => e.blockErrors))} func=${r.evals.map(e=>e.funcErrors)} ${r.ms}ms`);
}
process.exit(bad);
