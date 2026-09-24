"""
Verification of the best design:
  (a) exact orthographic check at several resolutions / blur / noise, both decoders
  (b) mirrored views (looking from the opposite side)
  (c) pinhole-camera (phone-like) perspective rendering vs distance
"""
import numpy as np, json
from scipy import ndimage
from PIL import Image
from qr3 import *
from solver import solve, evaluate

links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
c = json.load(open("best_combo.json"))["combo"]
QZ = np.rot90(qr_matrix(links[0], mask=c[0]), c[1])
QY = np.rot90(qr_matrix(links[1], mask=c[2]), c[3])
QX = np.rot90(qr_matrix(links[2], mask=c[4]), c[5])
k = 5
F, V, T, info = solve(QZ, QY, QX, k=k)
np.save("F_best.npy", F)
print("(a) orthographic")
evaluate(F, QZ, QY, QX, k, links, label="best")

# resolution, blur and noise sweep
PZ, PY, PX = project(F)
ok = {}
for ppc in (1, 2, 4):
    for bl in (0.0, 1.0, 2.0, 4.0):
        for nz in (0, 15, 30):
            r = []
            for P, l in ((PZ, links[0]), (PY, links[1]), (PX, links[2])):
                zb, zx = decode_all(to_image(P, px_per_cell=ppc, pad_cells=4 * k, blur=bl * ppc / 2, noise=nz))
                r.append((l in zb) or (l in zx))
            ok[(ppc, bl, nz)] = all(r)
passed = sum(ok.values())
print(f"   resolution, blur and noise sweep (px/voxel x blur x noise): {passed}/{len(ok)} settings decode all 3 views (either decoder)")
print("   failures:", [k_ for k_, v in ok.items() if not v])

print("(b) mirrored views (opposite side of the object)")
for P, l, nm in ((PZ, links[0], "bottom"), (PY, links[1], "back"), (PX, links[2], "other side")):
    im = to_image(P[:, ::-1], px_per_cell=2, pad_cells=4 * k, blur=1.5)
    zb, zx = decode_all(im)
    print(f"   {nm:10s}: zbar={l in zb} zxing={l in zx}")


# ------------------------------------------------------------ (c) perspective
def render_persp(F, axis, dist, res=420, fov_pad=1.25, step=0.5):
    """Pinhole camera on +axis side at `dist` (voxel units) from object centre, looking at centre.
       Returns silhouette image (res x res bool), image u ~ first remaining axis, v ~ second."""
    n = F.shape[0]
    ctr = np.array([n / 2] * 3)
    a1, a2 = [a for a in range(3) if a != axis]
    cam = ctr.copy(); cam[axis] += dist
    half = (n / 2) * fov_pad / (dist - n / 2)  # tan half-angle so the near face fits
    us = np.linspace(-half, half, res)
    U, W = np.meshgrid(us, us, indexing="ij")
    d = np.zeros((res * res, 3)); d[:, axis] = -1; d[:, a1] = U.ravel(); d[:, a2] = W.ravel()
    t0, t1 = dist - n / 2 - 1, dist + n / 2 + 1
    ts = np.arange(t0, t1, step)
    out = np.zeros(res * res, dtype=bool)
    for s in range(0, res * res, 4000):
        dd = d[s:s + 4000]
        P = cam[None, None, :] + dd[:, None, :] * ts[None, :, None]
        I = np.floor(P).astype(int)
        inside = np.all((I >= 0) & (I < n), axis=2)
        I = np.clip(I, 0, n - 1)
        hit = F[I[..., 0], I[..., 1], I[..., 2]] & inside
        out[s:s + 4000] = hit.any(1)
    return out.reshape(res, res)

print("(c) perspective (phone-like pinhole camera). module = 3 mm -> object %.1f cm cube" % (QZ.shape[0] * 3 / 10))
mm_per_voxel = 3.0 / k
for dist_cm in (25, 40, 60, 100, 150, 250):
    dist = dist_cm * 10 / mm_per_voxel
    r = []
    for axis, l in ((2, links[0]), (1, links[1]), (0, links[2])):
        S = render_persp(F, axis, dist)
        im = to_image(S, px_per_cell=1, pad_cells=40, blur=1.0, noise=8)
        zb, zx = decode_all(im)
        r.append("OK" if (l in zb or l in zx) else "--")
        if dist_cm in (40, 250) and axis == 2:
            im.save(f"figures/persp_top_{dist_cm}cm.png")
    print(f"   camera at {dist_cm:4d} cm: top/front/side = {r}")
