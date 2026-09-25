"""
Empirical check of the "boundary lattice" theorem:
  With k-subdivided voxels and module-boundary pixels treated as don't-care,
  the maximal allowed set A is a SINGLE 6-connected component.
"""
import numpy as np
from scipy import ndimage
from tqr.qr3 import *

links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
QZ, QY, QX = [qr_matrix(l) for l in links]
n = QZ.shape[0]

for k in (4, 5, 6):
    upZ, bZ, fZ = fine_view_classes(QZ, k)
    upY, bY, fY = fine_view_classes(QY, k)
    upX, bX, fX = fine_view_classes(QX, k)
    A = (~fZ)[:, :, None] & (~fY)[:, None, :] & (~fX)[None, :, :]
    lab, nc = ndimage.label(A, structure=S6)
    PZ, PY, PX = project(A)
    # coverage: fraction of black-module interior pixels that are dark
    cov = [((P & up & ~b).sum() / (up & ~b).sum()) for P, up, b in ((PZ, upZ, bZ), (PY, upY, bY), (PX, upX, bX))]
    viol = [int((P & f).sum()) for P, f in ((PZ, fZ), (PY, fY), (PX, fX))]
    print(f"k={k}: fine grid {A.shape[0]}^3, |A|={A.sum()}, components(6-conn)={nc}, "
          f"black coverage={[round(c*100,2) for c in cov]}%, forbidden-pixel violations={viol}")
    res = []
    for P, l in ((PZ, links[0]), (PY, links[1]), (PX, links[2])):
        zb, zx = decode_all(to_image(P, px_per_cell=2, pad_cells=4 * k))
        res.append((l in zb, l in zx))
    print("   decode (zbar, zxing) per view:", res)
