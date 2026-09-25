import numpy as np
import qrcode
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import ndimage
from tqr.paths import FIGURES

def make_qr_matrix(data, error_correction=qrcode.constants.ERROR_CORRECT_H):
    qr = qrcode.QRCode(error_correction=error_correction, box_size=1, border=0)
    qr.add_data(data); qr.make(fit=True)
    return np.array(qr.get_matrix(), dtype=np.uint8)

def pad_to(mat, N):
    h, _ = mat.shape
    pre = (N - h) // 2
    out = np.zeros((N, N), dtype=np.uint8)
    out[pre:pre+h, pre:pre+h] = mat
    return out

links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
mats = [make_qr_matrix(l) for l in links]
N = max(m.shape[0] for m in mats)
Tz, Ty, Tx = [pad_to(m, N) for m in mats]
Tz_b, Ty_b, Tx_b = Tz.astype(bool), Ty.astype(bool), Tx.astype(bool)
V = Tz_b[:, :, None] & Ty_b[:, None, :] & Tx_b[None, :, :]

structure6 = ndimage.generate_binary_structure(3, 1)
labeled, n = ndimage.label(V, structure=structure6)
sizes = ndimage.sum(V, labeled, range(1, n+1))
largest_label = np.argmax(sizes) + 1

fig = plt.figure(figsize=(14, 7))

ax1 = fig.add_subplot(121, projection="3d")
xs, ys, zs = np.where(V)
ax1.scatter(xs, ys, zs, c="#3a3a3a", s=6, alpha=0.6)
ax1.set_title(f"Full AND-carved solution\n{V.sum()} voxels -- looks solid enough to decode,\nbut is mostly disconnected dust")
ax1.set_box_aspect([1,1,1])

ax2 = fig.add_subplot(122, projection="3d")
mask_largest = (labeled == largest_label)
xs2, ys2, zs2 = np.where(mask_largest)
ax2.scatter(xs2, ys2, zs2, c="#c0392b", s=10)
ax2.set_title(f"Only the LARGEST physically-connected chunk\n{int(sizes.max())} voxels ({100*sizes.max()/V.sum():.1f}% of total)\n-- everything else would fall off a printer")
ax2.set_box_aspect([1,1,1])

plt.tight_layout()
plt.savefig(FIGURES / "dust_vs_connected.png", dpi=140)
print("saved")
