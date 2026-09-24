"""
Core library: tri-view silhouette QR sculpture.

Coordinates: voxel V[x, y, z].
  view Z (top)   sees image indexed [x, y]  -> QR_Z
  view Y (front) sees image indexed [x, z]  -> QR_Y
  view X (side)  sees image indexed [y, z]  -> QR_X
Silhouette model: pixel is dark iff ANY voxel on its (orthographic) ray is solid.
"""
import numpy as np
import qrcode
from scipy import ndimage
from PIL import Image, ImageFilter
from pyzbar.pyzbar import decode as zbar_decode
import zxingcpp

S6 = ndimage.generate_binary_structure(3, 1)


def qr_matrix(data, mask=None, version=None, ec=qrcode.constants.ERROR_CORRECT_H):
    qr = qrcode.QRCode(version=version, error_correction=ec, box_size=1, border=0,
                       mask_pattern=mask)
    qr.add_data(data)
    qr.make(fit=(version is None))
    return np.array(qr.get_matrix(), dtype=bool)


def and_carve(QZ, QY, QX):
    """Module-level maximal solution (the 'dust')."""
    return QZ[:, :, None] & QY[:, None, :] & QX[None, :, :]


def project(V):
    return V.any(axis=2), V.any(axis=1), V.any(axis=0)  # Z[x,y], Y[x,z], X[y,z]


# ---------------------------------------------------------------- decoding
def to_image(mask, px_per_cell=1, pad_cells=0, blur=0.0, noise=0.0, seed=0):
    img = np.where(mask, 0, 255).astype(np.uint8)
    im = Image.fromarray(img)
    if px_per_cell != 1:
        im = im.resize((img.shape[1] * px_per_cell, img.shape[0] * px_per_cell), Image.NEAREST)
    if pad_cells:
        p = pad_cells * px_per_cell
        canvas = Image.new("L", (im.width + 2 * p, im.height + 2 * p), 255)
        canvas.paste(im, (p, p))
        im = canvas
    if blur > 0:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    if noise > 0:
        a = np.asarray(im).astype(np.float32)
        a += np.random.default_rng(seed).normal(0, noise, a.shape)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return im


def decode_all(im):
    """Return (zbar_results, zxing_results) as lists of strings."""
    zb = [r.data.decode("utf-8", "replace") for r in zbar_decode(im)]
    zx = [r.text for r in zxingcpp.read_barcodes(im) if r.valid]
    return zb, zx


# ---------------------------------------------------------------- fine grid
def fine_view_classes(Q, k):
    """For a module image Q (n x n bool), return per-pixel arrays at k-subdivision:
       black  : pixel inside a black module
       bnd    : pixel on the (one-sided) module boundary line (u%k==0 or v%k==0)
       forbid : pixel inside a white module AND not on boundary (decoder-sampled region)
    """
    up = np.kron(Q, np.ones((k, k), dtype=bool))
    n = up.shape[0]
    u = np.arange(n)
    bnd = (u[:, None] % k == 0) | (u[None, :] % k == 0)
    forbid = (~up) & (~bnd)
    return up, bnd, forbid


def exposed_faces_mesh(V, scale=1.0):
    """Blocky surface of a voxel set -> (triangles Nx3x3). Greedy merge along one axis."""
    tris = []
    Vp = np.pad(V, 1)
    for axis in range(3):
        for sgn in (+1, -1):
            nb = np.roll(Vp, -sgn, axis=axis)
            face = Vp & ~nb  # face on the +sgn side of voxel
            face = face[1:-1, 1:-1, 1:-1]
            idx = np.argwhere(face)
            if len(idx) == 0:
                continue
            # merge runs along the next axis (a1) for fewer triangles
            a1, a2 = [a for a in range(3) if a != axis]
            order = np.lexsort((idx[:, a1], idx[:, a2], idx[:, axis]))
            idx = idx[order]
            start = 0
            L = len(idx)
            while start < L:
                end = start
                while (end + 1 < L and idx[end + 1, axis] == idx[start, axis]
                       and idx[end + 1, a2] == idx[start, a2]
                       and idx[end + 1, a1] == idx[end, a1] + 1):
                    end += 1
                p = idx[start].astype(float)
                run = end - start + 1
                plane = p[axis] + (1 if sgn > 0 else 0)
                c0 = p[a1]; c1 = p[a1] + run
                d0 = p[a2]; d1 = p[a2] + 1
                def P(c, d):
                    v = np.zeros(3); v[axis] = plane; v[a1] = c; v[a2] = d
                    return v * scale
                q = [P(c0, d0), P(c1, d0), P(c1, d1), P(c0, d1)]
                # orientation: outward normal along +/- axis
                t1, t2 = (q[0], q[1], q[2]), (q[0], q[2], q[3])
                n = np.cross(q[1] - q[0], q[2] - q[0])
                if np.sign(n[axis]) != sgn:
                    t1, t2 = (q[0], q[2], q[1]), (q[0], q[3], q[2])
                tris.append(t1); tris.append(t2)
                start = end + 1
    return np.array(tris)
