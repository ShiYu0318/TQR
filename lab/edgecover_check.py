"""Claim: with two QR views (top (x,y), front (x,z)) and a third view that only FORBIDS (side pixel (y,z) white => no cube),
the minimum number of cubes covering every black pixel of both QR views splits by slice x into independent problems:
  slice x: bipartite graph  L = {y : top(x,y) black},  R = {z : front(x,z) black},  edge (y,z) iff side(y,z) allowed.
  minimum edge cover = |L| + |R| - maximum matching   (Gallai), provided no isolated vertex.
Check against the MILP on the same instance."""
import numpy as np, time
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import maximum_bipartite_matching
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy import sparse
from tri import build_views, logo

views = build_views(["https://s.gd/aaa1", "https://s.gd/bbb2"], "2qr_logo", logo_kind="heart")
QT, QF = views[0].T, views[1].T
L = views[2].T                                   # badge logo: dark = allowed
n = QT.shape[0]
t = time.time()
total, isolated = 0, 0
for x in range(n):
    Ls = np.flatnonzero(QT[x]); Rs = np.flatnonzero(QF[x])
    if len(Ls) == 0 and len(Rs) == 0: continue
    A = L[np.ix_(Ls, Rs)].astype(np.int8)        # edge (y,z) allowed iff logo pixel dark
    iso = int((A.sum(1) == 0).sum() + (A.sum(0) == 0).sum())
    isolated += iso
    m = maximum_bipartite_matching(csr_matrix(A), perm_type="column")   # Hopcroft-Karp
    nu = int((m >= 0).sum())
    total += (len(Ls) - (A.sum(1) == 0).sum()) + (len(Rs) - (A.sum(0) == 0).sum()) - nu
t_match = time.time() - t
# MILP on the same relaxed problem (cover coverable black pixels of the two QR views, cubes only where logo dark)
cells = [(x, y, z) for x in range(n) for y in range(n) for z in range(n) if QT[x, y] and QF[x, z] and L[y, z]]
idx = {c: i for i, c in enumerate(cells)}
rows, cols, r = [], [], 0
for x in range(n):
    for y in np.flatnonzero(QT[x]):
        ids = [idx[(x, y, z)] for z in range(n) if (x, y, z) in idx]
        if ids: rows += [r] * len(ids); cols += ids; r += 1
    for z in np.flatnonzero(QF[x]):
        ids = [idx[(x, y, z)] for y in range(n) if (x, y, z) in idx]
        if ids: rows += [r] * len(ids); cols += ids; r += 1
A = sparse.csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(r, len(cells)))
t = time.time()
res = milp(np.ones(len(cells)), constraints=LinearConstraint(A, 1, np.inf), integrality=np.ones(len(cells)), bounds=Bounds(0, 1),
           options={"time_limit": 300})
print(f"per-slice edge cover (Hopcroft-Karp): {total} cubes in {t_match*1000:.0f} ms  (uncoverable pixels skipped: {isolated})")
print(f"MILP optimum on the same problem:     {int(round(res.fun))} cubes in {time.time()-t:.1f} s, status={res.status}")
