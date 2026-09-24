const TRI = require('./tri_core.js'); TRI.setTables(require('./qr_tables.json'));
const qrcode = require('qrcode-generator');
function mat(t, type){ const q = qrcode(type, 'H'); q.addData(t, 'Byte'); q.make(); const n = q.getModuleCount(), M = new Uint8Array(n*n); for (let r=0;r<n;r++) for (let c=0;c<n;c++) M[r*n+c] = q.isDark(r,c)?1:0; return M; }
for (const type of [3, 7]) {
  const qr = ['https://s.gd/aaa1','https://s.gd/bbb2','https://s.gd/ccc3'].map(t => mat(t, type));
  for (const method of ['bridge', 'bridge+strut', 'strut']) {
    const r = TRI.generate({qr, version: type, level: 'H', mode: '3qr', method, budget: 0.5});
    console.log(`v${type} ${method.padEnd(13)} ${r.ms} ms  cubes=${r.cubes} struts=${r.struts} pieces=${r.pieces} cert=${r.evals.every(e=>e.ok)}`);
  }
}
