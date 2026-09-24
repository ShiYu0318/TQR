"""
Five-view "egg-crate" QR tile.

Each QR module = one open cell with 4 bi-colour walls + a floor.
  floor                      -> QR_T   (seen from above; walls are edge-on)
  south wall, face -> north  -> QR_N   (seen by a viewer standing NORTH)
  north wall, face -> south  -> QR_S
  west  wall, face -> east   -> QR_E
  east  wall, face -> west   -> QR_W
From a side viewer at elevation beta < atan(h/g) the floor is hidden by the near wall,
the two parallel walls are edge-on and the far wall shows its coloured face -> one clean code.
World axes: x = east, y = north, z = up.  Colour codes: 0 empty, 1 white, 2 black.
"""
import numpy as np
from qr3 import qr_matrix, decode_all
from PIL import Image, ImageFilter
import zxingcpp
from pyzbar.pyzbar import decode as zbar_decode

EMPTY, WHITE, BLACK = 0, 1, 2


def build_tile(Q, p=10, h=8, border=4, cap=BLACK, corner=BLACK):
    """Q: dict view->bool matrix (True=black) in *viewer-image* orientation (row 0 = top of viewer's image)."""
    n = Q["T"].shape[0]
    m = n + 2 * border
    X = m * p
    G = np.zeros((X, X, h + 2), dtype=np.uint8)
    G[:, :, 0] = WHITE                                   # floor base (quiet zone white)
    # map viewer-image module (r,c) -> cell (i=east index, j=north index) for each view
    def cell_of(view, r, c):
        if view == "T": return c, n - 1 - r          # looking down, image up = north
        if view == "N": return n - 1 - c, r          # viewer north looking south: image right = west, top = far = south
        if view == "S": return c, n - 1 - r          # viewer south looking north: right = east, top = far = north
        if view == "E": return n - 1 - r, n - 1 - c  # viewer east looking west: right = north?  -> see note below
        if view == "W": return r, c
    # note for E/W: viewer east looking west has image-right = south (y decreasing) and top = far = west.
    #   E: col c -> j = n-1-c (right = south),  row r -> i = n-1-r? far = west = small i -> top row r=0 -> i=0
    def cell_E(r, c): return r, n - 1 - c
    # viewer west looking east: image-right = north (j increasing), top = far = east (i large)
    def cell_W(r, c): return n - 1 - r, c
    for view in ("T", "N", "S", "E", "W"):
        for r in range(n):
            for c in range(n):
                if view == "E": i, j = cell_E(r, c)
                elif view == "W": i, j = cell_W(r, c)
                else: i, j = cell_of(view, r, c)
                col = BLACK if Q[view][r, c] else WHITE
                x0, y0 = (i + border) * p, (j + border) * p
                if view == "T":
                    G[x0:x0 + p, y0:y0 + p, 0] = col
                elif view == "N":   # south wall (y offset 0), face points north
                    G[x0:x0 + p, y0, 1:h + 1] = col
                elif view == "S":   # north wall (y offset p-1), face points south
                    G[x0:x0 + p, y0 + p - 1, 1:h + 1] = col
                elif view == "E":   # west wall (x offset 0), face points east
                    G[x0, y0:y0 + p, 1:h + 1] = col
                elif view == "W":   # east wall (x offset p-1), face points west
                    G[x0 + p - 1, y0:y0 + p, 1:h + 1] = col
    # wall corners: white; wall caps: white top layer
    for i in range(n):
        for j in range(n):
            x0, y0 = (i + border) * p, (j + border) * p
            for dx in (0, p - 1):
                for dy in (0, p - 1):
                    G[x0 + dx, y0 + dy, 1:h + 1] = corner
    walls = G[:, :, 1:h + 1].any(axis=2)
    G[:, :, h + 1] = np.where(walls, cap, EMPTY)          # 1-voxel cap
    return G


def render(G, az_deg, el_deg, dist, res=520, fov_deg=None, step=0.25, light=(0.3, 0.2, 1.0), seed=0):
    """Pinhole camera. az: direction the camera stands (0=north, 90=east). el: elevation above the tile.
       dist in voxels from tile centre. Returns grayscale PIL image."""
    X, Y, Z = G.shape
    ctr = np.array([X / 2, Y / 2, 0.0])
    az, el = np.radians(az_deg), np.radians(el_deg)
    dirc = np.array([np.sin(az) * np.cos(el), np.cos(az) * np.cos(el), np.sin(el)])
    C = ctr + dist * dirc
    f = (ctr - C); f /= np.linalg.norm(f)
    up_w = np.array([0, 0, 1.0]) if el_deg < 89 else np.array([-np.sin(az), -np.cos(az), 0.0]) * -1
    if el_deg >= 89: up_w = np.array([0, 1.0, 0])
    r = np.cross(f, up_w); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    if fov_deg is None:
        fov_deg = 2 * np.degrees(np.arctan((X * 0.75) / dist))
    th = np.tan(np.radians(fov_deg / 2))
    s = np.linspace(-th, th, res)
    PX, PY = np.meshgrid(s, -s)            # image row 0 = top
    D = f[None, None, :] + PX[..., None] * r + PY[..., None] * u
    D = D.reshape(-1, 3); D /= np.linalg.norm(D, axis=1, keepdims=True)
    L = np.array(light); L /= np.linalg.norm(L)
    out = np.full(len(D), 0.82)            # table background (light grey)
    zt = Z  # slab top
    for s0 in range(0, len(D), 3000):
        d = D[s0:s0 + 3000]
        dz = d[:, 2]
        t_in = (C[2] - zt) / -dz
        t_out = (C[2] - 0.0) / -dz
        nsteps = int(np.ceil((t_out - t_in).max() / step)) + 2
        ts = t_in[:, None] + step * np.arange(nsteps)[None, :]
        P = C[None, None, :] + d[:, None, :] * ts[..., None]
        I = np.floor(P).astype(int)
        inside = (I[..., 0] >= 0) & (I[..., 0] < X) & (I[..., 1] >= 0) & (I[..., 1] < Y) & (I[..., 2] >= 0) & (I[..., 2] < Z)
        Ic = np.clip(I, 0, [X - 1, Y - 1, Z - 1])
        col = np.where(inside, G[Ic[..., 0], Ic[..., 1], Ic[..., 2]], 0)
        hit = col > 0
        anyhit = hit.any(1)
        first = hit.argmax(1)
        rows = np.arange(len(d))
        c = col[rows, first]
        # face normal: axis whose integer coordinate changed entering the voxel
        prev = I[rows, np.maximum(first - 1, 0)]
        cur = I[rows, first]
        diff = cur - prev
        nrm = np.zeros((len(d), 3))
        ax = np.argmax(np.abs(diff), axis=1)
        nrm[rows, ax] = -np.sign(diff[rows, ax])
        nrm[(np.abs(diff).sum(1) == 0)] = [0, 0, 1]
        shade = 0.45 + 0.55 * np.clip(nrm @ L, 0, 1)
        alb = np.where(c == BLACK, 0.07, 0.92)
        val = np.where(anyhit, alb * shade, 0.82)
        out[s0:s0 + 3000] = val
    img = (out.reshape(res, res) * 255).astype(np.uint8)
    im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(0.8))
    a = np.asarray(im).astype(np.float32) + np.random.default_rng(seed).normal(0, 6, (res, res))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def read(im):
    zb = [r.data.decode("utf-8", "replace") for r in zbar_decode(im)]
    zx = []
    for r in zxingcpp.read_barcodes(im):
        if not r.valid:
            continue
        p = r.position
        tl, tr, br = np.array([p.top_left.x, p.top_left.y]), np.array([p.top_right.x, p.top_right.y]), np.array([p.bottom_right.x, p.bottom_right.y])
        a, b = tr - tl, br - tl
        zx.append((r.text, bool(a[0] * b[1] - a[1] * b[0] < 0)))   # True = mirrored
    return zb, zx
