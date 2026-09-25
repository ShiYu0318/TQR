/* Tri-view silhouette QR solver (browser / worker / node). Mirrors tri.py + qrstruct.py.
   Images are flat arrays indexed i*n+j with (i,j) = (x,y) top, (x,z) front, (y,z) side.
   Cells are indexed x*n*n + y*n + z. */
var TRI = (function () {
  "use strict";
  var TABLES = null;                       // {rs: {"3H": [[total,data],...]}, align: {"3": [6,22]}}
  var INF = 1e9;

  function setTables(t) { TABLES = t; }

  // ------------------------------------------------------------ QR structure + certificate
  function functionClasses(version) {
    var n = 17 + 4 * version, L = new Int8Array(n * n), r, c;
    function fill(r0, r1, c0, c1, val) {
      for (r = Math.max(r0, 0); r < Math.min(r1, n); r++) for (c = Math.max(c0, 0); c < Math.min(c1, n); c++) L[r * n + c] = val;
    }
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(function (p) {
      fill(p[0] - 1, p[0] + 8, p[1] - 1, p[1] + 8, 2);
      fill(p[0], p[0] + 7, p[1], p[1] + 7, 1);
    });
    for (c = 8; c < n - 8; c++) { L[6 * n + c] = 3; L[c * n + 6] = 3; }
    var pos = TABLES.align[String(version)] || [];
    pos.forEach(function (ar) {
      pos.forEach(function (ac) {
        if ((ar < 9 && ac < 9) || (ar < 9 && ac > n - 10) || (ar > n - 10 && ac < 9)) return;
        fill(ar - 2, ar + 3, ac - 2, ac + 3, 4);
      });
    });
    function fmt(rr, cc) { if (L[rr * n + cc] !== 1) L[rr * n + cc] = 5; }
    for (c = 0; c < 9; c++) { fmt(8, c); fmt(c, 8); }
    for (c = n - 8; c < n; c++) { fmt(8, c); fmt(c, 8); }
    if (version >= 7) { for (r = 0; r < 6; r++) for (c = n - 11; c < n - 8; c++) { fmt(r, c); fmt(c, r); } }
    L[(n - 8) * n + 8] = 6;
    return L;
  }

  var P_TABLE = {"1L": 3, "1M": 2, "1Q": 1, "1H": 1, "2L": 2, "3L": 1};

  function structure(version, level) {
    var n = 17 + 4 * version, fclass = functionClasses(version), func = new Uint8Array(n * n), i;
    for (i = 0; i < n * n; i++) func[i] = fclass[i] > 0 ? 1 : 0;
    var blocks = TABLES.rs[version + level], ndata = [], nec = [], total = 0;
    blocks.forEach(function (b) { ndata.push(b[1]); nec.push(b[0] - b[1]); total += b[0]; });
    var blk = [], maxd = Math.max.apply(null, ndata), maxe = Math.max.apply(null, nec), bi;
    for (i = 0; i < maxd; i++) for (bi = 0; bi < ndata.length; bi++) if (i < ndata[bi]) blk.push(bi);
    for (i = 0; i < maxe; i++) for (bi = 0; bi < nec.length; bi++) if (i < nec[bi]) blk.push(bi);
    var cw = new Int32Array(n * n).fill(-1), j = 0, col = n - 1, up = true, r, k;
    while (col > 0) {
      if (col === 6) col--;
      for (k = 0; k < n; k++) {
        r = up ? n - 1 - k : k;
        [col, col - 1].forEach(function (cc) {
          if (!func[r * n + cc]) { cw[r * n + cc] = j < total * 8 ? (j >> 3) : -2; j++; }
        });
      }
      up = !up; col -= 2;
    }
    var p = P_TABLE[version + level] || 0;
    return {n: n, version: version, level: level, func: func, fclass: fclass, cw: cw, blk: Int32Array.from(blk),
            cap: Int32Array.from(nec.map(function (e) { return Math.floor((e - p) / 2); })), total: total, nec: nec};
  }

  function certificate(P, T, S) {
    var n2 = T.length, bad = new Uint8Array(S.total), funcErr = 0, wrong = 0, i;
    for (i = 0; i < n2; i++) {
      if (P[i] === T[i]) continue;
      wrong++;
      if (S.func[i]) funcErr++;
      else if (S.cw[i] >= 0) bad[S.cw[i]] = 1;
    }
    var per = new Int32Array(S.cap.length), badCount = 0;
    for (i = 0; i < S.total; i++) if (bad[i]) { per[S.blk[i]]++; badCount++; }
    var ok = funcErr === 0;
    for (i = 0; i < per.length; i++) if (per[i] > S.cap[i]) ok = false;
    return {ok: ok, funcErrors: funcErr, blockErrors: Array.from(per), cap: Array.from(S.cap), wrong: wrong, badCodewords: badCount};
  }

  // ------------------------------------------------------------ views
  function makeView(kind, T, S, opts) {
    opts = opts || {};
    var n = Math.round(Math.sqrt(T.length)), v = {kind: kind, T: T, S: S, n: n}, i;
    if (kind === "qr") {
      v.func = S.func; v.cw = S.cw; v.fclass = S.fclass;
      v.budgetFrac = opts.budget == null ? 0.5 : opts.budget;
      v.budget = Array.from(S.cap).map(function (c) { return Math.floor(v.budgetFrac * c + 1e-9); });
    } else {
      v.func = new Uint8Array(n * n); v.cw = new Int32Array(n * n).fill(-1); v.fclass = new Int8Array(n * n);
    }
    var allow = opts.allowFunc || [];
    v.benign = new Uint8Array(n * n);
    for (i = 0; i < n * n; i++) v.benign[i] = (v.func[i] && allow.indexOf(v.fclass[i]) >= 0) ? 1 : 0;
    v.funcCost = opts.funcCost || 4.0;
    v.accepted = new Uint8Array(n * n);
    v.Tqr = T;                          // certificate reference; differs from T only under an overlay
    v.preBad = null;                    // codewords an overlay (centre logo) already breaks
    v.keepLight = null;                 // overlay pixels that must stay light (bridges go around them)
    if (kind === "logo") {
      var white = 0; for (i = 0; i < n * n; i++) if (!T[i]) white++;
      v.logoBudget = Math.floor((opts.logoBudget == null ? 0.1 : opts.logoBudget) * white);
    } else v.logoBudget = 0;
    return v;
  }

  // Show `pixels` inside `region` (a centre logo) instead of the QR there; function modules are never overridden.
  // Codewords the overlay breaks count as errors from the start; bridges may use budgetFrac of the capacity LEFT:
  //   budget = logoErrors + floor(budgetFrac * (cap - logoErrors)).  The certificate always uses the original QR.
  function overlay(v, region, pixels) {
    var n2 = v.T.length, T = new Uint8Array(v.T), keep = new Uint8Array(n2), pre = new Uint8Array(v.S.total), i, b;
    for (i = 0; i < n2; i++) if (region[i] && !v.func[i]) { T[i] = pixels[i] ? 1 : 0; keep[i] = pixels[i] ? 0 : 1; }
    for (i = 0; i < n2; i++) if (T[i] !== v.T[i] && v.cw[i] >= 0) pre[v.cw[i]] = 1;
    var preBlk = new Int32Array(v.S.cap.length);
    for (i = 0; i < v.S.total; i++) if (pre[i]) preBlk[v.S.blk[i]]++;
    for (b = 0; b < preBlk.length; b++) if (preBlk[b] > v.S.cap[b]) throw new Error("LOGO_TOO_LARGE:" + b + ":" + preBlk[b] + ":" + v.S.cap[b]);
    v.Tqr = v.T; v.T = T; v.preBad = pre; v.preBlk = preBlk; v.keepLight = keep;
    v.budget = Array.from(v.S.cap).map(function (c, b) { return preBlk[b] + Math.floor(v.budgetFrac * (c - preBlk[b]) + 1e-9); });
    return v;
  }

  function required(v) {
    if (v.kind === "wall") return new Uint8Array(v.T.length).fill(1);
    return v.T;
  }

  function viewState(v, dark) {
    if (v.kind === "qr") {
      var bad = new Uint8Array(v.S.total), i;
      for (i = 0; i < dark.length; i++) {
        var flipped = (dark[i] && !v.T[i] && !v.func[i]) || (v.accepted[i] && !dark[i]);
        if (flipped && v.cw[i] >= 0) bad[v.cw[i]] = 1;
      }
      if (v.preBad) for (i = 0; i < v.S.total; i++) if (v.preBad[i]) bad[i] = 1;
      var blkBad = new Int32Array(v.S.cap.length);
      for (i = 0; i < v.S.total; i++) if (bad[i]) blkBad[v.S.blk[i]]++;
      return {bad: bad, blkBad: blkBad};
    }
    if (v.kind === "logo") {
      var f = 0; for (var j = 0; j < dark.length; j++) if (dark[j] && !v.T[j]) f++;
      return {flips: f};
    }
    return {};
  }

  function pixelCost(v, dark, st) {
    var n2 = dark.length, out = new Float64Array(n2), i;
    if (v.kind === "wall") return out;
    if (v.kind === "logo") {
      var c = st.flips < v.logoBudget ? 1.0 : INF;
      for (i = 0; i < n2; i++) out[i] = (dark[i] || v.T[i]) ? 0 : c;
      return out;
    }
    for (i = 0; i < n2; i++) {
      if (dark[i] || v.T[i]) { out[i] = 0; continue; }
      if (v.keepLight && v.keepLight[i]) { out[i] = INF; continue; }   // never deface the overlay
      if (v.func[i]) { out[i] = v.benign[i] ? v.funcCost : INF; continue; }
      var k = v.cw[i];
      if (k === -2) { out[i] = 0; continue; }
      var b = v.S.blk[k];
      if (st.bad[k]) out[i] = 0.05;
      else if (st.blkBad[b] < v.budget[b]) out[i] = 1.0 + st.blkBad[b] / Math.max(v.budget[b], 1);
      else out[i] = INF;
    }
    return out;
  }

  // ------------------------------------------------------------ grid helpers
  function feasibleSet(views, n) {
    var N3 = n * n * n, V = new Uint8Array(N3), T = views.map(function (v) { return v.kind === "wall" ? null : v.T; });
    for (var x = 0; x < n; x++) for (var y = 0; y < n; y++) {
      if (T[0] && !T[0][x * n + y]) continue;
      for (var z = 0; z < n; z++) {
        if (T[1] && !T[1][x * n + z]) continue;
        if (T[2] && !T[2][y * n + z]) continue;
        V[(x * n + y) * n + z] = 1;
      }
    }
    return V;
  }

  function project(V, n) {
    var P = [new Uint8Array(n * n), new Uint8Array(n * n), new Uint8Array(n * n)];
    for (var x = 0; x < n; x++) for (var y = 0; y < n; y++) for (var z = 0; z < n; z++) {
      if (!V[(x * n + y) * n + z]) continue;
      P[0][x * n + y] = 1; P[1][x * n + z] = 1; P[2][y * n + z] = 1;
    }
    return P;
  }

  function label(V, n) {
    var N3 = n * n * n, lab = new Int32Array(N3), K = 0, stack = new Int32Array(N3), sizes = [0];
    for (var s = 0; s < N3; s++) {
      if (!V[s] || lab[s]) continue;
      K++; var top = 0, size = 0; stack[top++] = s; lab[s] = K;
      while (top) {
        var c = stack[--top]; size++;
        var z = c % n, y = ((c / n) | 0) % n, x = (c / (n * n)) | 0;
        var nb = [x > 0 ? c - n * n : -1, x < n - 1 ? c + n * n : -1, y > 0 ? c - n : -1, y < n - 1 ? c + n : -1, z > 0 ? c - 1 : -1, z < n - 1 ? c + 1 : -1];
        for (var q = 0; q < 6; q++) { var d = nb[q]; if (d >= 0 && V[d] && !lab[d]) { lab[d] = K; stack[top++] = d; } }
      }
      sizes.push(size);
    }
    return {lab: lab, K: K, sizes: sizes};
  }

  function components(V, n) {
    var L = label(V, n), tot = 0, mx = 0;
    for (var k = 1; k <= L.K; k++) { tot += L.sizes[k]; if (L.sizes[k] > mx) mx = L.sizes[k]; }
    return {pieces: L.K, mainShare: tot ? mx / tot : 0};
  }

  // binary min-heap keyed by float
  function Heap(cap) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  Heap.prototype.push = function (key, val) {
    if (this.n >= this.k.length) {
      var k2 = new Float64Array(this.k.length * 2), v2 = new Int32Array(this.k.length * 2);
      k2.set(this.k); v2.set(this.v); this.k = k2; this.v = v2;
    }
    var i = this.n++, K = this.k, Vv = this.v;
    while (i > 0) { var p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; Vv[i] = Vv[p]; i = p; }
    K[i] = key; Vv[i] = val;
  };
  Heap.prototype.pop = function () {
    var K = this.k, Vv = this.v, topv = Vv[0], topk = K[0], lastk = K[--this.n], lastv = Vv[this.n], i = 0, n = this.n;
    while (true) {
      var l = 2 * i + 1; if (l >= n) break;
      var r = l + 1, m = (r < n && K[r] < K[l]) ? r : l;
      if (K[m] >= lastk) break;
      K[i] = K[m]; Vv[i] = Vv[m]; i = m;
    }
    K[i] = lastk; Vv[i] = lastv;
    this.lastKey = topk;
    return topv;
  };

  // node-weighted multi-source Dijkstra on the n^3 grid (entering cell c costs cost(c)+eps)
  function dijkstraCells(n, sources, costFn, eps) {
    var N3 = n * n * n, dist = new Float64Array(N3).fill(Infinity), pred = new Int32Array(N3).fill(-1), done = new Uint8Array(N3);
    var h = new Heap(1 << 16), i;
    for (i = 0; i < sources.length; i++) { dist[sources[i]] = 0; h.push(0, sources[i]); }
    while (h.n) {
      var u = h.pop(), du = h.lastKey;
      if (done[u] || du > dist[u]) continue;
      done[u] = 1;
      var z = u % n, y = ((u / n) | 0) % n, x = (u / (n * n)) | 0;
      var nb = [x > 0 ? u - n * n : -1, x < n - 1 ? u + n * n : -1, y > 0 ? u - n : -1, y < n - 1 ? u + n : -1, z > 0 ? u - 1 : -1, z < n - 1 ? u + 1 : -1];
      for (var q = 0; q < 6; q++) {
        var v = nb[q]; if (v < 0 || done[v]) continue;
        var c = costFn(v); if (c >= INF) continue;
        var nd = du + c + eps;
        if (nd < dist[v]) { dist[v] = nd; pred[v] = u; h.push(nd, v); }
      }
    }
    return {dist: dist, pred: pred};
  }

  // ------------------------------------------------------------ method: bridge (new)
  function solveBridge(views, n, opts) {
    opts = opts || {};
    var maxAdd = opts.maxAdd || 6, eps = 1e-3, N3 = n * n * n, n2 = n * n, i, k, vi;
    var Vf = feasibleSet(views, n), L = label(Vf, n), lab = L.lab, K = L.K;
    var req = views.map(required);
    // per-component unique pixel lists (global pixel id = vi*n2 + p)
    var compPix = [], seen = new Map();
    for (k = 0; k <= K; k++) compPix.push([]);
    var mark = new Int32Array(3 * n2).fill(0);
    var compCells = []; for (k = 0; k <= K; k++) compCells.push([]);
    for (var c = 0; c < N3; c++) {
      if (!lab[c]) continue;
      compCells[lab[c]].push(c);
    }
    for (k = 1; k <= K; k++) {
      var list = compCells[k];
      for (i = 0; i < list.length; i++) {
        var cc = list[i], z = cc % n, y = ((cc / n) | 0) % n, x = (cc / n2) | 0;
        var ids = [x * n + y, n2 + x * n + z, 2 * n2 + y * n + z];
        for (var q = 0; q < 3; q++) if (mark[ids[q]] !== k) { mark[ids[q]] = k; compPix[k].push(ids[q]); }
      }
    }
    // orphans
    var cover = project(Vf, n), orphans = 0;
    for (vi = 0; vi < 3; vi++) for (i = 0; i < n2; i++) if (req[vi][i] && !cover[vi][i]) {
      orphans++;
      if (views[vi].kind === "qr" && views[vi].cw[i] >= 0) views[vi].accepted[i] = 1;
    }
    var M = new Uint8Array(N3), inM = new Uint8Array(K + 1), bridges = 0, seeds = 0, it = 0;
    function addComp(k2) { var l = compCells[k2]; for (var j = 0; j < l.length; j++) M[l[j]] = 1; inM[k2] = 1; }
    while (true) {
      it++;
      if (it > 5000) break;
      var dark = project(M, n);
      var unc = new Uint8Array(3 * n2), nunc = 0;
      for (vi = 0; vi < 3; vi++) for (i = 0; i < n2; i++) {
        if (req[vi][i] && !dark[vi][i] && !(views[vi].kind === "qr" && views[vi].accepted[i])) { unc[vi * n2 + i] = 1; nunc++; }
      }
      if (!nunc) break;
      var gain = new Float64Array(K + 1);
      for (k = 1; k <= K; k++) { if (inM[k]) continue; var g = 0, pl = compPix[k]; for (i = 0; i < pl.length; i++) g += unc[pl[i]]; gain[k] = g; }
      var options = [], D = null;
      var anyM = false; for (i = 0; i < N3; i++) if (M[i]) { anyM = true; break; }
      if (anyM) {
        var sts = views.map(function (v, j) { return viewState(v, dark[j]); });
        var costs = views.map(function (v, j) { return pixelCost(v, dark[j], sts[j]); });
        var costFn = function (cell) {
          if (M[cell]) return 0;
          var z2 = cell % n, y2 = ((cell / n) | 0) % n, x2 = (cell / n2) | 0;
          return costs[0][x2 * n + y2] + costs[1][x2 * n + z2] + costs[2][y2 * n + z2];
        };
        var srcs = []; for (i = 0; i < N3; i++) if (M[i]) srcs.push(i);
        D = dijkstraCells(n, srcs, costFn, eps);
        var reach = new Float64Array(K + 1).fill(Infinity), best = new Int32Array(K + 1).fill(-1);
        for (i = 0; i < N3; i++) { var l2 = lab[i]; if (l2 && D.dist[i] < reach[l2]) { reach[l2] = D.dist[i]; best[l2] = i; } }
        for (k = 1; k <= K; k++) if (!inM[k] && gain[k] > 0 && reach[k] < INF / 10) options.push({s: reach[k] / gain[k], comp: k, cell: best[k]});
        // orphan pixels: cheapest reachable cell on their ray
        for (vi = 0; vi < 3; vi++) for (i = 0; i < n2; i++) {
          if (!unc[vi * n2 + i] || cover[vi][i]) continue;
          var a = (i / n) | 0, b = i % n, bestD = Infinity, bestC = -1;
          for (var t = 0; t < n; t++) {
            var cell = vi === 0 ? (a * n + b) * n + t : (vi === 1 ? (a * n + t) * n + b : (t * n + a) * n + b);
            if (D.dist[cell] < bestD) { bestD = D.dist[cell]; bestC = cell; }
          }
          if (bestC >= 0 && bestD < INF / 10) options.push({s: bestD, comp: 0, cell: bestC});
        }
        options.sort(function (p, q2) { return p.s - q2.s; });
      }
      if (!options.length) {
        var bk = -1, bg = 0;
        for (k = 1; k <= K; k++) if (!inM[k] && gain[k] > bg) { bg = gain[k]; bk = k; }
        if (bk < 0) break;
        addComp(bk); seeds++; continue;
      }
      var first = options[0].s, added = 0;
      for (var oi = 0; oi < options.length; oi++) {
        var o = options[oi];
        if (added >= maxAdd || o.s > 2.5 * first + 1e-9) break;
        var path = [], ti = o.cell;
        while (ti >= 0 && !M[ti]) { path.push(ti); ti = D.pred[ti]; }
        if (added) {   // stale-cost guard
          var dk = project(M, n), st2 = views.map(function (v, j) { return viewState(v, dk[j]); });
          var cs2 = views.map(function (v, j) { return pixelCost(v, dk[j], st2[j]); }), okp = true;
          for (var pi = 0; pi < path.length; pi++) {
            var ce = path[pi], z3 = ce % n, y3 = ((ce / n) | 0) % n, x3 = (ce / n2) | 0;
            if (cs2[0][x3 * n + y3] + cs2[1][x3 * n + z3] + cs2[2][y3 * n + z3] >= INF) { okp = false; break; }
          }
          if (!okp) continue;
        }
        for (var pj = 0; pj < path.length; pj++) { if (!Vf[path[pj]]) bridges++; M[path[pj]] = 1; }
        if (o.comp) addComp(o.comp);
        added++;
      }
      if (!added) {
        if (!options[0].comp) break;
        addComp(options[0].comp); seeds++;
      }
    }
    var comp = components(M, n);
    var Bmask = new Uint8Array(N3); for (i = 0; i < N3; i++) if (M[i] && !Vf[i]) Bmask[i] = 1;
    return {V: M, bridgeMask: Bmask, bridges: bridges, pieces: comp.pieces, mainShare: comp.mainShare, seeds: seeds, orphans: orphans};
  }

  // ------------------------------------------------------------ struts (Mehlhorn Steiner tree on module-corner lattice)
  function connectPieces(V, views, n, kw) {
    kw = kw || 5.0;
    var N3 = n * n * n, n2 = n * n, L = label(V, n), lab = L.lab, K = L.K, i;
    if (K <= 1) return [];
    var w = views.map(function (v) { var a = new Float64Array(n2); if (v.kind !== "wall") for (i = 0; i < n2; i++) a[i] = v.T[i] ? 0 : 1; return a; });
    function edgeW(u, ax) {
      var z = u % n, y = ((u / n) | 0) % n, x = (u / n2) | 0, vv = u + (ax === 0 ? n2 : (ax === 1 ? n : 1));
      if (V[u] && V[vv] && lab[u] === lab[vv]) return 1e-6;
      if (ax === 0) return kw * w[0][x * n + y] + kw * w[1][x * n + z] + w[2][y * n + z] + 0.05;
      if (ax === 1) return kw * w[0][x * n + y] + w[1][x * n + z] + kw * w[2][y * n + z] + 0.05;
      return w[0][x * n + y] + kw * w[1][x * n + z] + kw * w[2][y * n + z] + 0.05;
    }
    // terminals: first cell of each piece
    var term = new Int32Array(K + 1).fill(-1);
    for (i = 0; i < N3; i++) if (lab[i] && term[lab[i]] < 0) term[lab[i]] = i;
    var dist = new Float64Array(N3).fill(Infinity), pred = new Int32Array(N3).fill(-1), src = new Int32Array(N3).fill(-1), done = new Uint8Array(N3);
    var h = new Heap(1 << 16);
    for (var k = 1; k <= K; k++) { dist[term[k]] = 0; src[term[k]] = k; h.push(0, term[k]); }
    while (h.n) {
      var u = h.pop(), du = h.lastKey;
      if (done[u] || du > dist[u]) continue;
      done[u] = 1;
      var z = u % n, y = ((u / n) | 0) % n, x = (u / n2) | 0;
      var nbs = [];
      if (x < n - 1) nbs.push([u + n2, edgeW(u, 0)]); if (x > 0) nbs.push([u - n2, edgeW(u - n2, 0)]);
      if (y < n - 1) nbs.push([u + n, edgeW(u, 1)]); if (y > 0) nbs.push([u - n, edgeW(u - n, 1)]);
      if (z < n - 1) nbs.push([u + 1, edgeW(u, 2)]); if (z > 0) nbs.push([u - 1, edgeW(u - 1, 2)]);
      for (var q = 0; q < nbs.length; q++) {
        var v = nbs[q][0], nd = du + nbs[q][1];
        if (!done[v] && nd < dist[v]) { dist[v] = nd; pred[v] = u; src[v] = src[u]; h.push(nd, v); }
      }
    }
    // best crossing edge per pair of Voronoi regions
    var bestPair = new Map();
    for (u = 0; u < N3; u++) {
      z = u % n; y = ((u / n) | 0) % n; x = (u / n2) | 0;
      var outs = [];
      if (x < n - 1) outs.push([u + n2, 0]); if (y < n - 1) outs.push([u + n, 1]); if (z < n - 1) outs.push([u + 1, 2]);
      for (q = 0; q < outs.length; q++) {
        var vv = outs[q][0];
        if (src[u] < 0 || src[vv] < 0 || src[u] === src[vv]) continue;
        var we = edgeW(u, outs[q][1]), cost = dist[u] + we + dist[vv];
        var a = Math.min(src[u], src[vv]), b = Math.max(src[u], src[vv]), key = a * (K + 1) + b;
        var cur = bestPair.get(key);
        if (!cur || cost < cur[0]) bestPair.set(key, [cost, a, b, u, vv]);
      }
    }
    var cand = Array.from(bestPair.values()).sort(function (p, q2) { return p[0] - q2[0]; });
    var parent = new Int32Array(K + 1); for (k = 0; k <= K; k++) parent[k] = k;
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    var edges = new Set();
    function addEdge(p, q2) { var lo = Math.min(p, q2), hi = Math.max(p, q2); edges.add(lo * N3 + hi); }
    for (i = 0; i < cand.length; i++) {
      var e = cand[i], ra = find(e[1]), rb = find(e[2]);
      if (ra === rb) continue;
      parent[ra] = rb;
      addEdge(e[3], e[4]);
      [e[3], e[4]].forEach(function (s) { while (pred[s] >= 0) { addEdge(s, pred[s]); s = pred[s]; } });
    }
    var out = [];
    edges.forEach(function (key) {
      var p = Math.floor(key / N3), q2 = key - p * N3;
      if (V[p] && V[q2] && lab[p] === lab[q2]) return;
      out.push([p, q2]);
    });
    return out;
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function pruneKeepCoverage(V, n, seed) {
    var rnd = mulberry32(seed || 1), n2 = n * n, N3 = n2 * n, i;
    var P = [new Int32Array(n2), new Int32Array(n2), new Int32Array(n2)];
    var cells = [];
    for (i = 0; i < N3; i++) if (V[i]) cells.push(i);
    cells.forEach(function (c) { var z = c % n, y = ((c / n) | 0) % n, x = (c / n2) | 0; P[0][x * n + y]++; P[1][x * n + z]++; P[2][y * n + z]++; });
    var L = label(V, n), keyed = cells.map(function (c) { return [L.sizes[L.lab[c]], rnd(), c]; });
    keyed.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var out = V.slice();
    keyed.forEach(function (t) {
      var c = t[2], z = c % n, y = ((c / n) | 0) % n, x = (c / n2) | 0;
      if (P[0][x * n + y] > 1 && P[1][x * n + z] > 1 && P[2][y * n + z] > 1) { out[c] = 0; P[0][x * n + y]--; P[1][x * n + z]--; P[2][y * n + z]--; }
    });
    return out;
  }

  // ------------------------------------------------------------ method: free (min cubes, greedy)
  function withinBudget(V, views, n) {
    var P = project(V, n);
    for (var vi = 0; vi < 3; vi++) {
      var v = views[vi];
      if (v.kind === "qr") {
        var c = certificate(P[vi], v.Tqr, v.S);
        if (c.funcErrors) return false;
        for (var b = 0; b < c.blockErrors.length; b++) if (c.blockErrors[b] > v.budget[b]) return false;
      } else if (v.kind === "logo") {
        var f = 0; for (var i = 0; i < P[vi].length; i++) if (P[vi][i] && !v.T[i]) f++;
        if (f > v.logoBudget) return false;
      }
    }
    return true;
  }
  function thirdMissing(V, views, n) {
    var P = project(V, n), m = 0;
    for (var vi = 0; vi < 3; vi++) {
      var v = views[vi]; if (v.kind === "qr") continue;
      for (var i = 0; i < P[vi].length; i++) if (!P[vi][i] && (v.kind === "wall" || v.T[i])) m++;
    }
    return m;
  }

  function solveFreeGreedy(views, n, opts) {
    opts = opts || {};
    var rnd = mulberry32(opts.seed || 1), n2 = n * n, N3 = n2 * n, i;
    var Vf = feasibleSet(views, n), req = views.map(required);
    var cells = [], pid = [];
    for (i = 0; i < N3; i++) if (Vf[i]) {
      var z = i % n, y = ((i / n) | 0) % n, x = (i / n2) | 0;
      cells.push(i); pid.push([x * n + y, n2 + x * n + z, 2 * n2 + y * n + z]);
    }
    var need = new Uint8Array(3 * n2);
    for (var vi = 0; vi < 3; vi++) for (i = 0; i < n2; i++) need[vi * n2 + i] = req[vi][i] ? 1 : 0;
    var byPix = new Map();
    pid.forEach(function (ids, ci) { ids.forEach(function (p) { if (!byPix.has(p)) byPix.set(p, []); byPix.get(p).push(ci); }); });
    var gain = pid.map(function (ids) { return need[ids[0]] + need[ids[1]] + need[ids[2]]; });
    var tie = cells.map(function () { return rnd() * 0.5; });
    var chosen = new Uint8Array(cells.length);
    // bucket queue over gain 1..3
    while (true) {
      var bi = -1, bv = 0;
      for (i = 0; i < cells.length; i++) if (!chosen[i] && gain[i] > 0 && gain[i] + tie[i] > bv) { bv = gain[i] + tie[i]; bi = i; }
      if (bi < 0) break;
      chosen[bi] = 1;
      pid[bi].forEach(function (p) {
        if (!need[p]) return;
        need[p] = 0;
        byPix.get(p).forEach(function (cj) { gain[cj]--; });
      });
    }
    var V = new Uint8Array(N3);
    for (i = 0; i < cells.length; i++) if (chosen[i]) V[cells[i]] = 1;
    // redundancy removal
    var order = []; for (i = 0; i < cells.length; i++) if (chosen[i]) order.push(i);
    for (i = order.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
    var cnt = [new Int32Array(n2), new Int32Array(n2), new Int32Array(n2)];
    order.forEach(function (ci) { for (var q = 0; q < 3; q++) cnt[q][pid[ci][q] - q * n2]++; });
    order.forEach(function (ci) {
      var ids = pid[ci];
      if (cnt[0][ids[0]] > 1 && cnt[1][ids[1] - n2] > 1 && cnt[2][ids[2] - 2 * n2] > 1) {
        V[cells[ci]] = 0; for (var q = 0; q < 3; q++) cnt[q][ids[q] - q * n2]--;
      }
    });
    if (opts.useBudget !== false) {
      var before = thirdMissing(V, views, n);
      order.forEach(function (ci) {
        var c = cells[ci]; if (!V[c]) return;
        V[c] = 0;
        if (withinBudget(V, views, n) && thirdMissing(V, views, n) <= before) return;
        V[c] = 1;
      });
    }
    return V;
  }

  // ------------------------------------------------------------ evaluation
  function evaluate(V, views, n) {
    var P = project(V, n);
    return views.map(function (v, vi) {
      if (v.kind === "qr") { var c = certificate(P[vi], v.Tqr, v.S); c.budget = v.budget; c.logoBlocks = v.preBlk ? Array.from(v.preBlk) : null; return c; }
      var flips = 0, missing = 0;
      for (var i = 0; i < P[vi].length; i++) {
        if (P[vi][i] && !v.T[i] && v.kind === "logo") flips++;
        if (!P[vi][i] && (v.kind === "wall" || v.T[i])) missing++;
      }
      return {ok: missing === 0 && flips <= v.logoBudget, flips: flips, missing: missing};
    });
  }

  // ------------------------------------------------------------ logos
  function logoRaw(kind, n) {
    var out = new Uint8Array(n * n), c = (n - 1) / 2;
    for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) {
      var u = (q - c) / (n / 2), v = (c - r) / (n / 2), val = false;
      if (kind === "heart") { var u2 = u * 1.25, v2 = v * 1.25 + 0.15; val = Math.pow(u2 * u2 + v2 * v2 - 1, 3) - u2 * u2 * v2 * v2 * v2 <= 0; }
      else if (kind === "star") { var ang = Math.atan2(v, u), rr = 0.45 + 0.4 * Math.abs(Math.cos(2.5 * (ang + Math.PI / 2))); val = Math.hypot(u, v) <= rr * 0.95; }
      else if (kind === "ring") { var rad = Math.hypot(u, v); val = rad <= 0.9 && rad >= 0.55; }
      out[r * n + q] = val ? 1 : 0;
    }
    return out;
  }
  function badge(raw, n) {
    var m = Math.max(1, Math.floor(n / 12)), out = new Uint8Array(n * n);
    for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) {
      var frame = r < m || r >= n - m || q < m || q >= n - m;
      out[r * n + q] = (frame || !raw[r * n + q]) ? 1 : 0;
    }
    return out;
  }

  // ------------------------------------------------------------ top-level
  /* spec: {qr: [Uint8Array n*n ...] (2 or 3), version, level, mode: '3qr'|'2qr_wall'|'2qr_logo', logo: Uint8Array,
            method: 'strut'|'bridge'|'bridge+strut'|'free'|'dust', relaxed: bool, budget, logoBudget} */
  function generate(spec) {
    var S = structure(spec.version, spec.level || "H"), n = S.n, t0 = Date.now();
    var opts = {budget: spec.budget, allowFunc: spec.relaxed ? [2, 3, 4] : [], logoBudget: spec.logoBudget};
    var views = spec.qr.map(function (T) { return makeView("qr", T, S, opts); });
    // spec.overlays[i] = {region, pixels} (Uint8Array n*n) puts a centre logo on QR view i
    (spec.overlays || []).forEach(function (o, i) { if (o && views[i] && views[i].kind === "qr") overlay(views[i], o.region, o.pixels); });
    if (spec.mode === "2qr_wall") views.push(makeView("wall", new Uint8Array(n * n).fill(1), null, opts));
    if (spec.mode === "2qr_logo") views.push(makeView("logo", spec.logo, null, opts));
    var V, E = [], bridgeMask = null, info = {};
    if (spec.method === "dust") V = feasibleSet(views, n);
    else if (spec.method === "strut") { V = pruneKeepCoverage(feasibleSet(views, n), n, 1); E = connectPieces(V, views, n); }
    else if (spec.method === "bridge" || spec.method === "bridge+strut") {
      var r = solveBridge(views, n, {});
      V = r.V; bridgeMask = r.bridgeMask; info = {bridges: r.bridges, seeds: r.seeds, orphans: r.orphans};
      if (spec.method === "bridge+strut") E = connectPieces(V, views, n);
    } else V = solveFreeGreedy(views, n, {});
    var comp = components(V, n), ev = evaluate(V, views, n), cubes = 0;
    for (var i = 0; i < V.length; i++) cubes += V[i];
    return {n: n, version: S.version, V: V, E: E, bridgeMask: bridgeMask, cubes: cubes, struts: E.length,
            pieces: comp.pieces, mainShare: comp.mainShare, onePiece: comp.pieces === 1 || E.length > 0,
            evals: ev, kinds: views.map(function (v) { return v.kind; }), info: info, ms: Date.now() - t0};
  }

  return {setTables: setTables, structure: structure, functionClasses: functionClasses, certificate: certificate,
          generate: generate, overlay: overlay, logoRaw: logoRaw, badge: badge, feasibleSet: feasibleSet, project: project,
          components: components, label: label};
})();
if (typeof module !== "undefined") module.exports = TRI;
