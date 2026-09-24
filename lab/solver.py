"""
Solver: tri-view silhouette QR sculpture that is ONE connected printable solid.

  1. AND-carve at module level -> candidate cubes (decode-correct, but dust).
  2. Greedy set-cover pruning: drop cubes whose 3 rays are all covered by others
     (small / isolated components removed first) -> fewer islands.
  3. Connect remaining islands with thin struts that run ONLY along the module-boundary
     lattice (they project onto grid lines in all 3 views, never onto a sampled module
     centre). Choose struts by a node-terminal Steiner tree (Mehlhorn 2-approx) with
     edge weight = pixels of white modules the strut would darken.
  4. Assemble at fine (k-subdivided) resolution and verify exactly.
"""
import numpy as np
import networkx as nx
from scipy import ndimage
from qr3 import *


def prune_cubes(V):
    V = V.copy()
    cZ, cY, cX = V.sum(2), V.sum(1), V.sum(0)
    lab, nc = ndimage.label(V, structure=S6)
    sizes = ndimage.sum(V, lab, range(1, nc + 1))
    cubes = np.argwhere(V)
    comp_size = sizes[lab[V] - 1]
    # remove from smallest components first; tie-break random for fairness
    order = np.lexsort((np.random.default_rng(0).random(len(cubes)), comp_size))
    for i in order:
        x, y, z = cubes[i]
        if cZ[x, y] > 1 and cY[x, z] > 1 and cX[y, z] > 1:
            V[x, y, z] = False
            cZ[x, y] -= 1; cY[x, z] -= 1; cX[y, z] -= 1
    return V


def lattice_graph(QZ, QY, QX, k, eps=0.05):
    n = QZ.shape[0]
    wZ, wY, wX = (~QZ).astype(float), (~QY).astype(float), (~QX).astype(float)
    G = nx.Graph()
    idx = lambda X, Y, Z: (X, Y, Z)
    for X in range(n):
        for Y in range(n):
            for Z in range(n):
                if X + 1 < n:   # along x: Z-view row in module (X,Y), Y-view row in (X,Z), X-view point (Y,Z)
                    G.add_edge((X, Y, Z), (X + 1, Y, Z), weight=k * wZ[X, Y] + k * wY[X, Z] + wX[Y, Z] + eps, axis=0)
                if Y + 1 < n:   # along y
                    G.add_edge((X, Y, Z), (X, Y + 1, Z), weight=k * wZ[X, Y] + wY[X, Z] + k * wX[Y, Z] + eps, axis=1)
                if Z + 1 < n:   # along z
                    G.add_edge((X, Y, Z), (X, Y, Z + 1), weight=wZ[X, Y] + k * wY[X, Z] + k * wX[Y, Z] + eps, axis=2)
    return G


def solve(QZ, QY, QX, k=5, prune=True, verbose=True):
    V0 = and_carve(QZ, QY, QX)
    V = prune_cubes(V0) if prune else V0
    lab, nc = ndimage.label(V, structure=S6)
    terminals = []
    for c in range(1, nc + 1):
        pts = np.argwhere(lab == c)
        terminals.append(tuple(pts[0]))
    G = lattice_graph(QZ, QY, QX, k)
    T = nx.algorithms.approximation.steiner_tree(G, terminals, weight="weight", method="mehlhorn") if nc > 1 else nx.Graph()
    n = QZ.shape[0]
    F = np.kron(V, np.ones((k, k, k), dtype=bool))
    for u, v in T.edges():
        a = np.array(u) * k; b = np.array(v) * k
        lo, hi = np.minimum(a, b), np.maximum(a, b)
        F[lo[0]:hi[0] + 1, lo[1]:hi[1] + 1, lo[2]:hi[2] + 1] = True
    info = dict(cubes_and=int(V0.sum()), cubes_kept=int(V.sum()), islands=nc,
                strut_edges=T.number_of_edges(), strut_weight=float(sum(d["weight"] for *_, d in T.edges(data=True))))
    if verbose:
        print(info)
    return F, V, T, info


def evaluate(F, QZ, QY, QX, k, links, label="", blur_list=(0, 1.5, 3.0), verbose=True):
    lab, nc = ndimage.label(F, structure=S6)
    PZ, PY, PX = project(F)
    out = {"components": nc, "voxels": int(F.sum())}
    rows = []
    for name, P, Q, link in (("top/Z", PZ, QZ, links[0]), ("front/Y", PY, QY, links[1]), ("side/X", PX, QX, links[2])):
        up, bnd, forbid = fine_view_classes(Q, k)
        viol = int((P & forbid).sum())
        white = ~up
        damage = (P & white).sum() / white.sum()
        # worst white module darkening
        per_mod = (P & white).reshape(Q.shape[0], k, Q.shape[1], k).sum((1, 3)) / (k * k)
        worst = per_mod[~Q].max() if (~Q).any() else 0
        cov = (P & up & ~bnd).sum() / (up & ~bnd).sum()
        dec = []
        for bl in blur_list:
            im = to_image(P, px_per_cell=2, pad_cells=4 * k, blur=bl, noise=8)
            zb, zx = decode_all(im)
            dec.append(("Z" if link in zb else "-") + ("X" if link in zx else "-"))
        rows.append((name, viol, round(100 * damage, 1), round(100 * worst, 1), round(100 * cov, 2), dec))
    if verbose:
        print(f"{label} components={nc} voxels={int(F.sum())}")
        for r in rows:
            print(f"   {r[0]:8s} forbidden-hits={r[1]}  white-area darkened={r[2]}%  worst white module={r[3]}%  "
                  f"black coverage={r[4]}%  decode[blur 0/1.5/3] (Z=zbar,X=zxing)={r[5]}")
    out["rows"] = rows
    return out


if __name__ == "__main__":
    links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
    QZ, QY, QX = [qr_matrix(l) for l in links]
    k = 5
    for prune in (False, True):
        print(f"\n=== prune={prune} ===")
        F, V, T, info = solve(QZ, QY, QX, k=k, prune=prune)
        evaluate(F, QZ, QY, QX, k, links, label=f"prune={prune}")
