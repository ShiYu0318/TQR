"""
Exploit QR coding freedom: 8 mask patterns x 4 rotations per code (32^3 = 32768 combos).
Every combination encodes the same 3 URLs; we pick the one whose sculpture is easiest to connect.
Stage 1: cheap proxy (islands after pruning) on random sample.  Stage 2: full Steiner on top-8.
"""
import numpy as np, time, itertools, json
from scipy import ndimage
from qr3 import *
from solver import prune_cubes, solve, evaluate

links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
base = [[qr_matrix(l, mask=m) for m in range(8)] for l in links]

def get(i, m, r):
    return np.rot90(base[i][m], r)

rng = np.random.default_rng(1)
combos = list(itertools.product(range(8), range(4), range(8), range(4), range(8), range(4)))
sample = [combos[j] for j in rng.choice(len(combos), 2500, replace=False)]
sample.append((None,) * 6)
t = time.time()
scores = []
default = [qr_matrix(l) for l in links]
for c in sample:
    if c[0] is None:
        QZ, QY, QX = default
    else:
        QZ, QY, QX = get(0, c[0], c[1]), get(1, c[2], c[3]), get(2, c[4], c[5])
    V = prune_cubes(and_carve(QZ, QY, QX))
    _, nc = ndimage.label(V, structure=S6)
    scores.append((nc, int(V.sum()), c))
print(f"stage1: {len(sample)} combos in {time.time()-t:.1f}s")
scores.sort(key=lambda s: (s[0], s[1]))
isl = np.array([s[0] for s in scores])
print(f"islands after pruning: best={isl.min()} median={int(np.median(isl))} worst={isl.max()}  default={[s[0] for s in scores if s[2][0] is None][0]}")

k = 5
best = None
for nc, nv, c in scores[:8]:
    QZ, QY, QX = get(0, c[0], c[1]), get(1, c[2], c[3]), get(2, c[4], c[5])
    F, V, T, info = solve(QZ, QY, QX, k=k, verbose=False)
    print(f"  combo(maskZ,rotZ,maskY,rotY,maskX,rotX)={c} islands={nc} cubes={nv} strut_weight={info['strut_weight']:.0f} voxels={int(F.sum())}")
    if best is None or info["strut_weight"] < best[0]:
        best = (info["strut_weight"], c)
print("best combo:", best)
json.dump({"combo": list(best[1])}, open("best_combo.json", "w"))
