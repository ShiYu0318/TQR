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


