"""
Extends carve_cube.py: adds physical printability analysis (connectivity,
floating voxels, wall thickness feasibility) and tests across different
QR sizes / link content, since decodability alone isn't the full story --
a 3D-printed cube needs to be a single connected solid, not a cloud of
disconnected specks.
"""
import numpy as np
import qrcode
from pyzbar.pyzbar import decode as zbar_decode
from PIL import Image
from scipy import ndimage

def make_qr_matrix(data, error_correction=qrcode.constants.ERROR_CORRECT_H, version=None):
    qr = qrcode.QRCode(version=version, error_correction=error_correction, box_size=1, border=0)
    qr.add_data(data)
    qr.make(fit=(version is None))
    return np.array(qr.get_matrix(), dtype=np.uint8), qr.version

def pad_to(mat, N):
    h, w = mat.shape
    pad_total = N - h
    assert pad_total >= 0
    pre = pad_total // 2
    out = np.zeros((N, N), dtype=np.uint8)
    out[pre:pre+h, pre:pre+w] = mat
    return out

def try_decode(mat, scale=10):
    img = Image.fromarray(np.where(mat == 1, 0, 255).astype(np.uint8))
    img = img.resize((mat.shape[1]*scale, mat.shape[0]*scale), Image.NEAREST)
    canvas = Image.new("L", (img.width + 8*scale, img.height + 8*scale), 255)
    canvas.paste(img, (4*scale, 4*scale))
    results = zbar_decode(canvas)
    return [r.data.decode("utf-8", errors="replace") for r in results]

def carve_and_analyze(links, label, error_correction=qrcode.constants.ERROR_CORRECT_H, version=None):
    print(f"\n{'='*60}\n{label}\n{'='*60}")
    mats, versions = [], []
    for link in links:
        m, v = make_qr_matrix(link, error_correction=error_correction, version=version)
        mats.append(m); versions.append(v)
    N = max(m.shape[0] for m in mats)
    print(f"links={links}")
    print(f"QR version(s)={versions}, canvas N={N}, black-density~{[round(100*m.sum()/m.size,1) for m in mats]}%")

    Tz, Ty, Tx = [pad_to(m, N) for m in mats]  # z=top, y=front, x=side
    Tz_b, Ty_b, Tx_b = Tz.astype(bool), Ty.astype(bool), Tx.astype(bool)

    V = Tz_b[:, :, None] & Ty_b[:, None, :] & Tx_b[None, :, :]
    occ = V.sum()
    print(f"Occupied voxels: {occ}/{N**3} ({100*occ/N**3:.2f}%)")

    # decode-error check
    Pz = V.any(axis=2).astype(np.uint8)
    Py = V.any(axis=1).astype(np.uint8)
    Px = V.any(axis=0).astype(np.uint8)
    for name, tgt, proj, link in [("top/Z", Tz, Pz, links[0]), ("front/Y", Ty, Py, links[1]), ("side/X", Tx, Px, links[2])]:
        black_needed = tgt.sum()
        missing = int(((tgt==1)&(proj==0)).sum())
        res = try_decode(proj)
        ok = "OK" if res and res[0] == link else "FAIL"
        print(f"  [{name}] modules-missing={missing}/{black_needed} ({100*missing/black_needed:.1f}%)  decode={res} [{ok}]")

    # connectivity / printability analysis (26-connectivity = full voxel adjacency incl. diagonals)
    structure = np.ones((3,3,3), dtype=bool)
    labeled, n_components = ndimage.label(V, structure=structure)
    sizes = ndimage.sum(V, labeled, range(1, n_components+1))
    largest = sizes.max() if n_components else 0
    print(f"Connected components (26-conn): {n_components}")
    print(f"  largest component: {int(largest)} voxels ({100*largest/occ:.1f}% of occupied) -- rest are floating islands")
    n_isolated = int((sizes == 1).sum())
    print(f"  single-voxel floating islands: {n_isolated}")

    # also check 6-connectivity (face-adjacent only -- what actually matters for FDM printing,
    # since a diagonal-only touch is not a real physical bridge of material)
    structure6 = ndimage.generate_binary_structure(3, 1)
    labeled6, n6 = ndimage.label(V, structure=structure6)
    sizes6 = ndimage.sum(V, labeled6, range(1, n6+1))
    largest6 = sizes6.max() if n6 else 0
    print(f"Connected components (6-conn, face-adjacency = real printable bridges): {n6}")
    print(f"  largest component: {int(largest6)} voxels ({100*largest6/occ:.1f}% of occupied)")

    return V

# Test 1: baseline cube, 3 short links, version auto (came out version 3 = 29x29 before)
carve_and_analyze(
    ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"],
    "TEST 1: Cube, 3 short links (~18 chars), auto version"
)

# Test 2: force smallest possible QR version (Version 1, 21x21) with even shorter payloads
carve_and_analyze(
    ["s.gd/a1", "s.gd/b2", "s.gd/c3"],
    "TEST 2: Cube, forced-small links, auto version (expect smaller N -> less depth redundancy)"
)

# Test 3: push it -- longer, realistic full URLs
carve_and_analyze(
    ["https://ncucp.example.org/join", "https://gdgoc-ncu.example.org/event", "https://iisr-lab.example.org/paper"],
    "TEST 3: Cube, realistic full-length URLs (bigger QR -> more depth -> expect it to get EASIER)"
)
