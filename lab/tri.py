"""
Tri-view silhouette sculptures: general solver.

Views (orthographic silhouettes of a module-level voxel set V[x,y,z]):
  view 0 (top,   along z) sees pixel (x, y)
  view 1 (front, along y) sees pixel (x, z)
  view 2 (side,  along x) sees pixel (y, z)
Each view is one of
  qr   : target QR matrix, with its RS structure -> exact decodability certificate + error budget
  logo : target pixel image; white pixels may be darkened up to a flip budget
  wall : solid square (every ray must be covered, nothing to keep white)

Connectivity modes
  free    : cubes need not touch (minimum count; MILP optimum or greedy)
  bridge  : NEW - one face-connected solid made only of module-size cubes; bridge cubes may darken white modules,
            paid for from the QR error-correction budget (repeat darkening of the same ray / codeword is free)
  strut   : thin struts along module boundaries connect the islands (they only touch don't-care pixels)
"""
import numpy as np
from scipy import ndimage, sparse
from scipy.sparse.csgraph import dijkstra, minimum_spanning_tree
from qrstruct import structure, certificate, make_qr

S6 = ndimage.generate_binary_structure(3, 1)
INF = 1e9


# ----------------------------------------------------------------------------- views
class View:
    def __init__(self, kind, T, S=None, budget_frac=0.5, logo_budget=0.0, allow_func=(), func_cost=4.0):
        from qrstruct import function_classes
        self.kind, self.T = kind, T.astype(bool)
        self.S = S
        n = T.shape[0]
        if kind == "qr":
            self.func = S["func"]
            self.cw = S["cw"]
            self.fclass = function_classes(S["version"])
            self.budget = np.floor(budget_frac * S["cap"]).astype(int)
        else:
            self.func = np.zeros((n, n), bool)
            self.cw = np.full((n, n), -1)
            self.fclass = np.zeros((n, n), np.int8)
        self.benign = np.isin(self.fclass, list(allow_func)) & self.func
        self.func_cost = func_cost
        self.accepted = np.zeros((n, n), bool)      # black data modules deliberately left white
        self.logo_budget = int(logo_budget * (~self.T).sum()) if kind == "logo" else 0

    def rotate(self, k):
        """Rotate target and all structure maps together (orientation freedom)."""
        self.T = np.rot90(self.T, k)
        for a in ("func", "cw", "fclass", "benign", "accepted"):
            setattr(self, a, np.rot90(getattr(self, a), k))
        return self

    def state(self, dark):
        """Committed errors given current projection."""
        if self.kind == "qr":
            flipped = (dark & ~self.T & ~self.func) | (self.accepted & ~dark)
            bad = np.zeros(self.S["total"], bool)
            c = self.cw[flipped & (self.cw >= 0)]
            bad[c] = True
            blk_bad = np.bincount(self.S["blk"][bad], minlength=len(self.S["cap"]))
            return {"bad": bad, "blk_bad": blk_bad}
        if self.kind == "logo":
            return {"flips": int((dark & ~self.T).sum())}
        return {}

    def pixel_cost(self, dark, st, eps_cw=0.05):
        """Cost of darkening each pixel now (0 if already dark or target black)."""
        n = self.T.shape[0]
        free = dark | self.T
        if self.kind == "wall":
            return np.zeros((n, n))
        if self.kind == "logo":
            c = 1.0 if st["flips"] < self.logo_budget else INF
            return np.where(free, 0.0, c)
        cost = np.full((n, n), INF)
        data = self.cw >= 0
        cwv = np.where(data, self.cw, 0)
        b = self.S["blk"][cwv]
        room = st["blk_bad"][b] < self.budget[b]
        already = st["bad"][cwv]
        dc = np.where(already, eps_cw, np.where(room, 1.0 + st["blk_bad"][b] / np.maximum(self.budget[b], 1), INF))
        cost = np.where(data, dc, cost)
        cost = np.where(self.cw == -2, 0.0, cost)          # remainder bits carry nothing
        cost = np.where(self.func, np.where(self.benign, self.func_cost, INF), cost)
        return np.where(free, 0.0, cost)


def project(V):
    return V.any(axis=2), V.any(axis=1), V.any(axis=0)


def cell_cost(costs):
    cZ, cY, cX = costs
    return cZ[:, :, None] + cY[:, None, :] + cX[None, :, :]


def feasible_set(views):
    """Maximal set with no new errors: every view's pixel must be target-black (wall = all)."""
    TZ, TY, TX = (v.T if v.kind != "wall" else np.ones_like(v.T) for v in views)
    return TZ[:, :, None] & TY[:, None, :] & TX[None, :, :]


def required(views):
    """Pixels that must end up dark (all target-black pixels; wall = everything)."""
    return [np.ones_like(v.T) if v.kind == "wall" else v.T for v in views]


# ----------------------------------------------------------------------------- grid graph
_graph_cache = {}


def grid_edges(n):
    if n in _graph_cache:
        return _graph_cache[n]
    idx = np.arange(n ** 3).reshape(n, n, n)
    src, dst = [], []
    for ax in range(3):
        a = np.take(idx, range(n - 1), axis=ax).ravel()
        b = np.take(idx, range(1, n), axis=ax).ravel()
        src += [a, b]; dst += [b, a]
    src, dst = np.concatenate(src), np.concatenate(dst)
    _graph_cache[n] = (src, dst)
    return src, dst


# ----------------------------------------------------------------------------- method: bridge (new)
def solve_bridge(views, max_add=6, eps=1e-3, verbose=False):
    """Grow a solid from module cubes only. Feasible cubes (no new error) are free; any other cube is a bridge whose
    cost is the error it adds (QR: codeword errors against a per-block budget, repeats on the same ray/codeword free;
    logo: flipped pixels). Function modules are forbidden unless marked benign. When nothing else is reachable
    (sealed pocket) a new piece is seeded. Returns the cube set and stats; pieces > 1 means sealed pockets remain."""
    n = views[0].T.shape[0]
    N3 = n ** 3
    Vf = feasible_set(views)
    lab, K = ndimage.label(Vf, structure=S6)
    req = required(views)
    xs, ys, zs = np.nonzero(Vf)
    comp = lab[xs, ys, zs] - 1
    pix = np.stack([xs * n + ys, n * n + xs * n + zs, 2 * n * n + ys * n + zs], 1)
    C = sparse.csr_matrix((np.ones(3 * len(comp)), (np.repeat(comp, 3), pix.ravel())), shape=(K, 3 * n * n))
    C.sum_duplicates(); C.data[:] = 1
    # orphans: required pixels whose ray holds no feasible cube -> accept as data error if possible
    orphans = 0
    cover = project(Vf)
    for v, r, d in zip(views, req, cover):
        miss = r & ~d
        if v.kind == "qr":
            v.accepted |= miss & (v.cw >= 0)
        orphans += int(miss.sum())
    cover = [c.copy() for c in cover]
    src, dst = grid_edges(n)
    M = np.zeros((n, n, n), bool)
    bridges, seeds, it = 0, 0, 0
    while True:
        it += 1
        dark = project(M)
        unc_maps = [r & ~d & ~(v.accepted if v.kind == "qr" else False) for v, r, d in zip(views, req, dark)]
        unc = np.concatenate([u.ravel() for u in unc_maps]).astype(float)
        if unc.sum() == 0:
            break
        gain = C @ unc
        inM = ndimage.maximum(M, lab, index=np.arange(1, K + 1)).astype(bool) if M.any() else np.zeros(K, bool)
        options = []
        if M.any():
            sts = [v.state(d) for v, d in zip(views, dark)]
            costs = [v.pixel_cost(d, s) for v, d, s in zip(views, dark, sts)]
            cc = cell_cost(costs).ravel()
            cc[M.ravel()] = 0.0
            w = np.where(cc[dst] >= INF, INF, cc[dst] + eps)
            G = sparse.csr_matrix((w, (src, dst)), shape=(N3, N3))
            dist, pred, _ = dijkstra(G, directed=True, indices=np.flatnonzero(M.ravel()),
                                     return_predecessors=True, min_only=True)
            dist3 = dist.reshape(n, n, n)
            reach = ndimage.minimum(dist3, lab, index=np.arange(1, K + 1))
            cand = np.flatnonzero((gain > 0) & ~inM & (reach < INF / 10))
            options = sorted((reach[k] / gain[k], k) for k in cand)
            # orphan pixels (no feasible cube on the ray): reach the cheapest cell on the ray
            for vi, um in enumerate(unc_maps):
                for p in np.argwhere(um & ~cover[vi]):
                    ray = dist3[p[0], p[1], :] if vi == 0 else (dist3[p[0], :, p[1]] if vi == 1 else dist3[:, p[0], p[1]])
                    j = int(np.argmin(ray))
                    if ray[j] < INF / 10:
                        cell = (p[0], p[1], j) if vi == 0 else ((p[0], j, p[1]) if vi == 1 else (j, p[0], p[1]))
                        options.append((float(ray[j]), ("cell", cell)))
            options.sort(key=lambda t: t[0])
        if not options:
            # sealed pocket (or first step): seed the most useful unreached component as a new piece
            k = int(np.argmax(np.where(inM, -1, gain)))
            if gain[k] <= 0:
                break
            M |= (lab == k + 1)
            seeds += 1
            continue
        first = options[0][0]
        n_added = 0
        for score, k in options:
            if n_added >= max_add or score > 2.5 * first + 1e-9:
                break
            if isinstance(k, tuple):
                ti = int(np.ravel_multi_index(k[1], (n, n, n)))
            else:
                cells = np.argwhere(lab == k + 1)
                dd = dist3[cells[:, 0], cells[:, 1], cells[:, 2]]
                ti = int(np.ravel_multi_index(tuple(cells[np.argmin(dd)]), (n, n, n)))
            path = []
            Mf = M.ravel()
            while ti >= 0 and not Mf[ti]:
                path.append(ti); ti = int(pred[ti])
            if n_added:   # stale-cost guard
                dark = project(M)
                sts = [v.state(d) for v, d in zip(views, dark)]
                costs = [v.pixel_cost(d, s) for v, d, s in zip(views, dark, sts)]
                ok = True
                for i in path:
                    x, y, z = np.unravel_index(i, (n, n, n))
                    if costs[0][x, y] + costs[1][x, z] + costs[2][y, z] >= INF:
                        ok = False; break
                if not ok:
                    continue
            bridges += sum(1 for i in path if not Vf.ravel()[i])
            Mf[path] = True
            M = Mf.reshape(n, n, n)
            if not isinstance(k, tuple):
                M |= (lab == k + 1)
            n_added += 1
        if n_added == 0:
            k = options[0][1]
            if isinstance(k, tuple):
                break
            M |= (lab == k + 1); seeds += 1
    pieces, share = components(M)
    if verbose:
        print(f"  bridge: cubes={int(M.sum())} bridges={bridges} pieces={pieces} (main {share:.1%}) seeds={seeds} iters={it} orphans={orphans}")
    return M, {"bridges": bridges, "pieces": pieces, "main_share": share, "seeds": seeds, "orphans": orphans}


def connect_pieces(V, views, k=5.0):
    """Mehlhorn Steiner tree on the module-corner lattice joining all pieces of V with thin struts."""
    n = V.shape[0]
    lab, K = ndimage.label(V, structure=S6)
    if K <= 1:
        return np.zeros((0, 2), int)
    wZ, wY, wX = [(~v.T).astype(float) if v.kind != "wall" else np.zeros_like(v.T, float) for v in views]
    idx = np.arange(n ** 3).reshape(n, n, n)
    X, Y, Z = np.meshgrid(np.arange(n), np.arange(n), np.arange(n), indexing="ij")
    A, B, W = [], [], []
    for ax in range(3):
        sl = [slice(None)] * 3; sl[ax] = slice(0, n - 1); sl = tuple(sl)
        a = idx[sl].ravel(); x, y, z = X[sl].ravel(), Y[sl].ravel(), Z[sl].ravel()
        if ax == 0:   w = k * wZ[x, y] + k * wY[x, z] + wX[y, z]
        elif ax == 1: w = k * wZ[x, y] + wY[x, z] + k * wX[y, z]
        else:         w = wZ[x, y] + k * wY[x, z] + k * wX[y, z]
        A.append(a); B.append(a + (n * n if ax == 0 else (n if ax == 1 else 1))); W.append(w + 0.05)
    a, b, w = np.concatenate(A), np.concatenate(B), np.concatenate(W)
    # corners inside a piece are free to join
    inside = V.ravel()
    w = np.where(inside[a] & inside[b] & (lab.ravel()[a] == lab.ravel()[b]), 1e-6, w)
    N3 = n ** 3
    G = sparse.csr_matrix((np.concatenate([w, w]), (np.concatenate([a, b]), np.concatenate([b, a]))), shape=(N3, N3))
    terms = np.array([int(idx[tuple(np.argwhere(lab == c + 1)[0])]) for c in range(K)])
    dist, pred, srcs = dijkstra(G, directed=False, indices=terms, return_predecessors=True, min_only=True)
    tid = {int(t): i for i, t in enumerate(terms)}
    su, sv = srcs[a], srcs[b]
    cross = (su != sv) & (su >= 0) & (sv >= 0)
    cwt = dist[a][cross] + w[cross] + dist[b][cross]
    pa = np.array([tid[int(s)] for s in su[cross]]); pb = np.array([tid[int(s)] for s in sv[cross]])
    lo, hi = np.minimum(pa, pb), np.maximum(pa, pb)
    key = lo * K + hi
    order = np.lexsort((cwt, key))
    first = np.r_[True, key[order][1:] != key[order][:-1]]
    sel = order[first]
    T = sparse.csr_matrix((cwt[sel], (lo[sel], hi[sel])), shape=(K, K))
    mst = minimum_spanning_tree(T).tocoo()
    look = {(int(p), int(q)): j for j, p, q in zip(sel, lo[sel], hi[sel])}
    crossidx = np.flatnonzero(cross)
    edges = set()
    for p, q in zip(mst.row, mst.col):
        j = crossidx[look[(int(min(p, q)), int(max(p, q)))]]
        u, v = int(a[j]), int(b[j])
        edges.add((min(u, v), max(u, v)))
        for s in (u, v):
            while pred[s] >= 0:
                t = int(pred[s]); edges.add((min(s, t), max(s, t))); s = t
    # drop strut edges whose both ends sit inside the same piece (they add nothing)
    out = [(u, v) for u, v in edges if not (inside[u] and inside[v] and lab.ravel()[u] == lab.ravel()[v])]
    return np.array(sorted(out)) if out else np.zeros((0, 2), int)


# ----------------------------------------------------------------------------- method: free (min cubes)
def solve_free_greedy(views, use_budget=True, seed=0):
    """Greedy set cover over feasible cubes, then budgeted removal (lets some black modules go white)."""
    n = views[0].T.shape[0]
    Vf = feasible_set(views)
    req = required(views)
    cells = np.argwhere(Vf)
    pid = np.stack([cells[:, 0] * n + cells[:, 1], n * n + cells[:, 0] * n + cells[:, 2], 2 * n * n + cells[:, 1] * n + cells[:, 2]], 1)
    need = np.concatenate([r.ravel() for r in req]).copy()
    chosen = np.zeros(len(cells), bool)
    # bucketed greedy: gain in {0..3}
    gain = need[pid].sum(1)
    rng = np.random.default_rng(seed)
    tie = rng.random(len(cells))
    while need.any():
        g = np.where(chosen, -1, gain + tie * 0.5)
        i = int(np.argmax(g))
        if gain[i] <= 0:
            break
        chosen[i] = True
        newly = pid[i][need[pid[i]]]
        need[newly] = False
        # update gains of cubes sharing those pixels
        hit = np.isin(pid, newly)
        gain -= hit.sum(1)
    V = np.zeros((n, n, n), bool)
    V[tuple(cells[chosen].T)] = True
    # redundancy removal (keep coverage) then budgeted removal
    order = np.flatnonzero(chosen)
    rng.shuffle(order)
    cnt = [np.zeros(n * n, int) for _ in range(3)]
    for i in np.flatnonzero(chosen):
        for vi in range(3):
            cnt[vi][pid[i][vi] - vi * n * n] += 1
    for i in order:
        if all(cnt[vi][pid[i][vi] - vi * n * n] > 1 for vi in range(3)):
            V[tuple(cells[i])] = False
            for vi in range(3):
                cnt[vi][pid[i][vi] - vi * n * n] -= 1
    before = third_missing(V, views)
    if use_budget:
        for i in order:
            c = tuple(cells[i])
            if not V[c]:
                continue
            V[c] = False
            if within_budget(V, views) and third_ok(V, views, before):
                continue
            V[c] = True
    return V


def solve_free_milp(views, use_budget=True, time_limit=120, lam=2.0):
    """Exact minimum cube count (HiGHS). QR black data modules may go white inside the per-block budget;
    wall/logo pixels are soft (penalty lam each); QR function modules are hard."""
    from scipy.optimize import milp, LinearConstraint, Bounds
    n = views[0].T.shape[0]
    Vf = feasible_set(views)
    req = required(views)
    cells = np.argwhere(Vf)
    nc = len(cells)
    pix = [cells[:, 0] * n + cells[:, 1], cells[:, 0] * n + cells[:, 2], cells[:, 1] * n + cells[:, 2]]
    by_pix = [dict() for _ in range(3)]
    for vi in range(3):
        order = np.argsort(pix[vi], kind="stable")
        pv = pix[vi][order]
        cuts = np.flatnonzero(np.r_[True, pv[1:] != pv[:-1], True])
        for a, b in zip(cuts[:-1], cuts[1:]):
            by_pix[vi][int(pv[a])] = order[a:b]
    rows, cols, vals, lb, ub = [], [], [], [], []
    cost = [1.0] * nc
    nv = nc
    evars, skipped = {}, 0
    r = 0
    for vi, (v, rq) in enumerate(zip(views, req)):
        for p in np.flatnonzero(rq.ravel()):
            ids = by_pix[vi].get(int(p), np.array([], int))
            slack = None
            if v.kind == "qr":
                if use_budget and v.cw.ravel()[p] >= 0:
                    k = int(v.cw.ravel()[p])
                    if (vi, k) not in evars:
                        evars[(vi, k)] = nv; cost.append(0.0); nv += 1
                    slack = evars[(vi, k)]
                elif v.cw.ravel()[p] == -2:
                    continue                       # remainder bit: free
            else:
                slack = nv; cost.append(lam); nv += 1
            if len(ids) == 0 and slack is None:
                skipped += 1; continue
            rows += [r] * len(ids); cols += list(ids); vals += [1] * len(ids)
            if slack is not None:
                rows.append(r); cols.append(slack); vals.append(1)
            lb.append(1); ub.append(np.inf); r += 1
    for vi, v in enumerate(views):
        if v.kind == "qr" and use_budget:
            for b in range(len(v.S["cap"])):
                ks = [evars[(vi, int(k))] for k in np.flatnonzero(v.S["blk"] == b) if (vi, int(k)) in evars]
                if ks:
                    rows += [r] * len(ks); cols += ks; vals += [1] * len(ks)
                    lb.append(-np.inf); ub.append(int(v.budget[b])); r += 1
    A = sparse.csr_matrix((vals, (rows, cols)), shape=(r, nv))
    res = milp(np.array(cost), constraints=LinearConstraint(A, lb, ub), integrality=np.ones(nv), bounds=Bounds(0, 1),
               options={"time_limit": time_limit, "disp": False})
    x = res.x[:nc] > 0.5 if res.x is not None else np.zeros(nc, bool)
    V = np.zeros((n, n, n), bool)
    V[tuple(cells[x].T)] = True
    return V, {"status": int(res.status), "gap": getattr(res, "mip_gap", None), "skipped": skipped,
               "lower_bound": getattr(res, "mip_dual_bound", None)}


# ----------------------------------------------------------------------------- method: strut
def prune_keep_coverage(V, views, seed=0):
    V = V.copy()
    n = V.shape[0]
    cnt = project_counts(V)
    lab, K = ndimage.label(V, structure=S6)
    sizes = ndimage.sum(V, lab, range(1, K + 1))
    cells = np.argwhere(V)
    order = np.lexsort((np.random.default_rng(seed).random(len(cells)), sizes[lab[V] - 1]))
    for i in order:
        x, y, z = cells[i]
        if cnt[0][x, y] > 1 and cnt[1][x, z] > 1 and cnt[2][y, z] > 1:
            V[x, y, z] = False
            cnt[0][x, y] -= 1; cnt[1][x, z] -= 1; cnt[2][y, z] -= 1
    return V


def project_counts(V):
    return V.sum(2), V.sum(1), V.sum(0)


def solve_strut(views, prune=True):
    """Original method: pruned feasible cubes + Steiner-tree struts along module boundaries."""
    V = feasible_set(views)
    if prune:
        V = prune_keep_coverage(V, views)
    E = connect_pieces(V, views)
    return V, E, {"islands": components(V)[0], "strut_edges": len(E)}


def strut_fine(V, E, k=5):
    """Fine voxel model (for exact checks): cubes k^3, struts 1 subvoxel wide on module-corner lines."""
    n = V.shape[0]
    F = np.kron(V, np.ones((k, k, k), bool))
    for u, v in E:
        pu = np.array(np.unravel_index(u, (n, n, n))) * k
        pv = np.array(np.unravel_index(v, (n, n, n))) * k
        lo, hi = np.minimum(pu, pv), np.maximum(pu, pv)
        F[lo[0]:hi[0] + 1, lo[1]:hi[1] + 1, lo[2]:hi[2] + 1] = True
    return F


# ----------------------------------------------------------------------------- evaluation
def within_budget(V, views):
    """Stricter than the certificate: QR errors must stay inside the safety budget, not just the RS capacity."""
    for v, d in zip(views, project(V)):
        if v.kind == "qr":
            c = certificate(d, v.T, v.S)
            if c["func_errors"] or (c["block_errors"] > v.budget).any():
                return False
        elif v.kind == "logo":
            if int((d & ~v.T).sum()) > v.logo_budget:
                return False
    return True


def third_missing(V, views):
    return sum(int((~d & v.T).sum()) if v.kind == "logo" else int((~d).sum())
               for v, d in zip(views, project(V)) if v.kind != "qr")


def third_ok(V, views, before):
    return third_missing(V, views) <= before


def evaluate_views(V, views):
    out = []
    for v, d in zip(views, project(V)):
        if v.kind == "qr":
            c = certificate(d, v.T, v.S)
            c["budget"] = v.budget
            out.append(c)
        elif v.kind == "logo":
            wrong = d != v.T
            out.append({"ok": int((d & ~v.T).sum()) <= v.logo_budget and int((~d & v.T).sum()) == 0,
                        "flips": int((d & ~v.T).sum()), "missing": int((~d & v.T).sum()), "pixel_err": float(wrong.mean())})
        else:
            out.append({"ok": bool(d.all()), "missing": int((~d).sum())})
    return out


def components(V):
    lab, K = ndimage.label(V, structure=S6)
    if K == 0:
        return 0, 0.0
    s = ndimage.sum(V, lab, range(1, K + 1))
    return K, float(s.max() / V.sum())


