"""
Space-carving feasibility test: can a single cube of shared voxels
simultaneously show 3 different QR codes along 3 orthogonal axes?

Model (standard "shadow art" / Boolean tomography formalism):
  - N x N x N voxel grid, binary occupied/empty.
  - 3 target bitmaps Tx, Ty, Tz (one per viewing axis), each N x N,
    1 = "must read as a dark QR module along this ray", 0 = "must be empty/light".
  - Hard constraint: a "white" ray must have ZERO occupied voxels along it
    (otherwise a stray voxel would show up as a black speck where the code
    demands white -> unrecoverable false-positive module).
  - Soft goal: a "black" ray must have AT LEAST ONE occupied voxel somewhere
    along it (that's what makes it read dark from that view).

  The unique *maximal* solution consistent with all hard white-constraints is:
      V[x,y,z] = 1  iff  Tx[y,z]==1 and Ty[x,z]==1 and Tz[x,y]==1
  (a voxel is allowed to exist only if none of the 3 rays through it demand white)

  This can never create a false "black->white" error in the other direction
  (no white constraint is ever violated), but it CAN fail to satisfy some
  "black" requirements (all candidate voxels on that ray got vetoed by a
  perpendicular white constraint). We measure exactly that failure rate,
  per axis, and see whether it's within a QR code's error-correction budget.
"""
import numpy as np
import qrcode
from pyzbar.pyzbar import decode as zbar_decode
from PIL import Image
from tqr.paths import FIGURES

def make_qr_matrix(data, box_size=1, border=0, error_correction=qrcode.constants.ERROR_CORRECT_H, version=None):
    qr = qrcode.QRCode(
        version=version,
        error_correction=error_correction,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=(version is None))
    matrix = np.array(qr.get_matrix(), dtype=np.uint8)  # True=black
    return matrix, qr.version

def pad_to(mat, N):
    """Center-pad a QR matrix (1=black module) into an NxN canvas of quiet-zone white,
    with a >=4-module quiet zone as per spec, using remaining space."""
    h, w = mat.shape
    assert h == w
    pad_total = N - h
    assert pad_total >= 0, f"target N={N} smaller than QR size {h}"
    pre = pad_total // 2
    post = pad_total - pre
    out = np.zeros((N, N), dtype=np.uint8)
    out[pre:pre+h, pre:pre+w] = mat
    return out

def render_png(mat, path, scale=10):
    img = Image.fromarray(np.where(mat == 1, 0, 255).astype(np.uint8))
    img = img.resize((mat.shape[1]*scale, mat.shape[0]*scale), Image.NEAREST)
    img.save(path)

def try_decode(mat, scale=10):
    img = Image.fromarray(np.where(mat == 1, 0, 255).astype(np.uint8))
    img = img.resize((mat.shape[1]*scale, mat.shape[0]*scale), Image.NEAREST)
    # add quiet zone margin in case pad wasn't enough for the scanner
    canvas = Image.new("L", (img.width + 8*scale, img.height + 8*scale), 255)
    canvas.paste(img, (4*scale, 4*scale))
    results = zbar_decode(canvas)
    return [r.data.decode("utf-8", errors="replace") for r in results]

# ---- 3 short links (use bit.ly-style short strings so the QR stays small) ----
links = [
    "https://s.gd/aaa1",   # -> "front"
    "https://s.gd/bbb2",   # -> "top"
    "https://s.gd/ccc3",   # -> "side"
]

mats = []
versions = []
for link in links:
    m, v = make_qr_matrix(link, error_correction=qrcode.constants.ERROR_CORRECT_H)
    mats.append(m)
    versions.append(v)
    print(f"{link!r}: QR version {v}, size {m.shape}")

N = max(m.shape[0] for m in mats)
# ensure room for a quiet zone-ish pad; use the max size directly (already includes border=0)
Tx, Ty, Tz = [pad_to(m, N) for m in mats]
print("Unified canvas size N =", N)

# ---- space carving: voxel allowed only if all three rays are 'black' there ----
# V[x,y,z] = Tz[x,y] & Ty[x,z] & Tx[y,z]
Tz_b = Tz.astype(bool)              # indexed [x,y]  (viewed along Z, top-down)
Ty_b = Ty.astype(bool)              # indexed [x,z]  (viewed along Y, front)
Tx_b = Tx.astype(bool)              # indexed [y,z]  (viewed along X, side)

V = np.zeros((N, N, N), dtype=bool)
for x in range(N):
    for y in range(N):
        for z in range(N):
            if Tz_b[x, y] and Ty_b[x, z] and Tx_b[y, z]:
                V[x, y, z] = True

occ = V.sum()
print(f"Occupied voxels: {occ} / {N**3} ({100*occ/N**3:.1f}%)")

def project(V, axis):
    return V.any(axis=axis)

Pz = project(V, axis=2).astype(np.uint8)   # collapse z -> [x,y], compare to Tz
Py = project(V, axis=1).astype(np.uint8)   # collapse y -> [x,z], compare to Ty
Px = project(V, axis=0).astype(np.uint8)   # collapse x -> [y,z], compare to Tx

def error_report(name, target, proj):
    black_needed = target.sum()
    black_missing = int(((target == 1) & (proj == 0)).sum())
    white_needed = (target == 0).sum()
    white_violated = int(((target == 0) & (proj == 1)).sum())
    err_rate = black_missing / black_needed if black_needed else 0
    print(f"[{name}] required-black={black_needed}  missing(->white)={black_missing}  "
          f"error_rate={err_rate*100:.1f}%   white_violations={white_violated} (should be 0)")
    return err_rate

er_z = error_report("Z/top   (link2)", Tz, Pz)
er_y = error_report("Y/front (link1)", Ty, Py)
er_x = error_report("X/side  (link3)", Tx, Px)

# ---- try actually decoding the resulting projections ----
print("\n--- Attempting to decode carved projections with a real QR reader ---")
for name, proj, orig_link in [("front(Y)", Py, links[0]), ("top(Z)", Pz, links[1]), ("side(X)", Px, links[2])]:
    render_png(proj, FIGURES / f"carved_{name}.png")
    res = try_decode(proj)
    print(f"{name}: decoded={res}  (expected {orig_link})")

# also confirm the ORIGINAL uncarved QR codes decode fine (sanity check on our pipeline)
print("\n--- Sanity check: original QR codes decode correctly on their own ---")
for name, mat, orig_link in [("orig_front", Ty, links[0]), ("orig_top", Tz, links[1]), ("orig_side", Tx, links[2])]:
    res = try_decode(mat)
    print(f"{name}: decoded={res} (expected {orig_link})")
