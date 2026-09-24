"""
Follow-up: the naive AND-carving decodes almost perfectly but produces
"voxel dust" (barely any face-connected material) -- not printable as one
solid. Test whether spending some of the QR's own error-correction budget
on a controlled dilation can buy back connectivity, and how much it costs.
"""
import numpy as np
import qrcode
from pyzbar.pyzbar import decode as zbar_decode
from PIL import Image
from scipy import ndimage

def make_qr_matrix(data, error_correction=qrcode.constants.ERROR_CORRECT_H, version=None):
    qr = qrcode.QRCode(version=version, error_correction=error_correction, box_size=1, border=0)
    qr.add_data(data); qr.make(fit=(version is None))
    return np.array(qr.get_matrix(), dtype=np.uint8), qr.version

def pad_to(mat, N):
    h, _ = mat.shape
    pre = (N - h) // 2
    out = np.zeros((N, N), dtype=np.uint8)
    out[pre:pre+h, pre:pre+h] = mat
    return out

def try_decode(mat, scale=10):
    img = Image.fromarray(np.where(mat == 1, 0, 255).astype(np.uint8))
    img = img.resize((mat.shape[1]*scale, mat.shape[0]*scale), Image.NEAREST)
    canvas = Image.new("L", (img.width + 8*scale, img.height + 8*scale), 255)
    canvas.paste(img, (4*scale, 4*scale))
    res = zbar_decode(canvas)
    return [r.data.decode("utf-8", errors="replace") for r in res]

links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
mats = [make_qr_matrix(l)[0] for l in links]
N = max(m.shape[0] for m in mats)
Tz, Ty, Tx = [pad_to(m, N) for m in mats]
Tz_b, Ty_b, Tx_b = Tz.astype(bool), Ty.astype(bool), Tx.astype(bool)

V = Tz_b[:, :, None] & Ty_b[:, None, :] & Tx_b[None, :, :]
print(f"N={N}, baseline occupied={V.sum()}")

structure6 = ndimage.generate_binary_structure(3, 1)

def report_connectivity(V, tag):
    labeled, n = ndimage.label(V, structure=structure6)
    if n == 0:
        print(f"  [{tag}] no material at all")
        return
    sizes = ndimage.sum(V, labeled, range(1, n+1))
    print(f"  [{tag}] occupied={int(V.sum())}  components={n}  largest={int(sizes.max())} ({100*sizes.max()/V.sum():.1f}%)")

def report_decode_cost(V, tag):
    Pz, Py, Px = V.any(axis=2).astype(np.uint8), V.any(axis=1).astype(np.uint8), V.any(axis=0).astype(np.uint8)
    total_extra = 0
    total_missing = 0
    for name, tgt, proj, link in [("top", Tz, Pz, links[0]), ("front", Ty, Py, links[1]), ("side", Tx, Px, links[2])]:
        extra = int(((tgt == 0) & (proj == 1)).sum())      # should-be-white pixels that turned black (NEW error type from dilation)
        missing = int(((tgt == 1) & (proj == 0)).sum())    # should-be-black pixels still missing
        total_extra += extra; total_missing += missing
        res = try_decode(proj)
        ok = "OK" if res and res[0] == link else "FAIL"
        print(f"    [{tag}/{name}] extra(white->black)={extra}  missing(black->white)={missing}  decode={res} [{ok}]")
    return total_extra, total_missing

report_connectivity(V, "baseline (pure AND, no dilation)")
report_decode_cost(V, "baseline")

for iterations in [1, 2, 3]:
    Vd = ndimage.binary_dilation(V, structure=structure6, iterations=iterations)
    print(f"\n--- dilation iterations={iterations} ---")
    report_connectivity(Vd, f"dilated x{iterations}")
    report_decode_cost(Vd, f"dilated x{iterations}")
