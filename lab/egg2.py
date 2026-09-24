"""
Egg-crate v2:
  * per-view rotation so the finder/timing/alignment patterns of all 5 codes land on the SAME cells
  * wall caps / corner posts coloured by a weighted vote over the 5 views
    (a boundary segment is a module boundary in every view; if both neighbours agree in a view,
     that view wants that colour; function-pattern agreement is weighted heavily)
  * lighting modes for rendering: 'overhead', 'flash' (camera headlight), 'mixed'
"""
import numpy as np
from PIL import Image, ImageFilter
from eggcrate import EMPTY, WHITE, BLACK, read

VIEWS = ("T", "N", "E", "S", "W")
AZ = {"N": 0, "E": 90, "S": 180, "W": 270}


def cell_map(view, r, c, n):
    """viewer-image module (r, c) -> cell (i = east idx, j = north idx), non-mirrored for that viewer."""
    if view == "T": return c, n - 1 - r
    if view == "N": return n - 1 - c, r
    if view == "S": return c, n - 1 - r
    if view == "E": return r, n - 1 - c
    if view == "W": return n - 1 - r, c


def function_mask(n):
    """Modules belonging to finder+separator (8x8 at 3 corners), timing row/col 6, alignment (v>=2)."""
    F = np.zeros((n, n), bool)
    F[:8, :8] = F[:8, n - 8:] = F[n - 8:, :8] = True
    F[6, :] = F[:, 6] = True
    if n >= 25:
        a = n - 7
        F[a - 2:a + 3, a - 2:a + 3] = True
    return F


def to_cells(M, view):
    n = M.shape[0]
    C = np.zeros((n, n), M.dtype)
    for r in range(n):
        for c in range(n):
            i, j = cell_map(view, r, c, n)
            C[i, j] = M[r, c]
    return C


def align_rotations(Q):
    """Rotate each view's code so the missing-finder corner maps to the same cell corner as view T."""
    n = Q["T"].shape[0]
    Fm = function_mask(n)
    target = to_cells(Fm, "T")
    out, rots = {}, {}
    for v in VIEWS:
        best = None
        for k in range(4):
            score = (to_cells(np.rot90(Fm, k), v) == target).mean()
            if best is None or score > best[0]:
                best = (score, k)
        rots[v] = best[1]
        out[v] = np.rot90(Q[v], best[1])
    return out, rots, target


def build_tile2(Q, p=10, h=8, border=4, fw=20.0, align=True, vote=True):
    n = Q["T"].shape[0]
    if align:
        Q, rots, Fcell = align_rotations(Q)
    else:
        rots, Fcell = {v: 0 for v in VIEWS}, to_cells(function_mask(n), "T")
    C = {v: to_cells(Q[v], v) for v in VIEWS}          # cell colours per view (True = black)
    m = n + 2 * border
    X = m * p
    G = np.zeros((X, X, h + 2), dtype=np.uint8)
    G[:, :, 0] = WHITE
    for i in range(n):
        for j in range(n):
            x0, y0 = (i + border) * p, (j + border) * p
            col = lambda v: BLACK if C[v][i, j] else WHITE
            G[x0:x0 + p, y0:y0 + p, 0] = col("T")
            G[x0:x0 + p, y0, 1:h + 1] = col("N")
            G[x0:x0 + p, y0 + p - 1, 1:h + 1] = col("S")
            G[x0, y0:y0 + p, 1:h + 1] = col("E")
            G[x0 + p - 1, y0:y0 + p, 1:h + 1] = col("W")

    def vote_color(cells):
        """cells: list of (i,j) sharing a boundary element. Returns BLACK/WHITE."""
        if not vote:
            return BLACK
        sb = sw = 0.0
        for v in VIEWS:
            vals = [C[v][i, j] for i, j in cells if 0 <= i < n and 0 <= j < n]
            if not vals:
                continue
            w = fw if any(Fcell[i, j] for i, j in cells if 0 <= i < n and 0 <= j < n) else 1.0
            if all(vals): sb += w
            elif not any(vals): sw += w
        return WHITE if sw > sb else BLACK   # ties -> black (dark lines are safer)

    cap = np.zeros((X, X), dtype=np.uint8)
    # vertical-in-x boundaries: between cell (i-1, j) and (i, j) -> skins at x0-1 and x0
    for i in range(n + 1):
        for j in range(n):
            x0, y0 = (i + border) * p, (j + border) * p
            c = vote_color([(i - 1, j), (i, j)])
            if i < n: cap[x0, y0:y0 + p] = c
            if i > 0: cap[x0 - 1, y0:y0 + p] = c
    for i in range(n):
        for j in range(n + 1):
            x0, y0 = (i + border) * p, (j + border) * p
            c = vote_color([(i, j - 1), (i, j)])
            if j < n: cap[x0:x0 + p, y0] = c
            if j > 0: cap[x0:x0 + p, y0 - 1] = c
    # corner posts (2x2 columns) : vote over 4 cells
    for i in range(n + 1):
        for j in range(n + 1):
            x0, y0 = (i + border) * p, (j + border) * p
            c = vote_color([(i - 1, j - 1), (i, j - 1), (i - 1, j), (i, j)])
            for dx in (-1, 0):
                for dy in (-1, 0):
                    xx, yy = x0 + dx, y0 + dy
                    if 0 <= xx < X and 0 <= yy < X and G[xx, yy, 1:h + 1].any():
                        G[xx, yy, 1:h + 1] = c
                        cap[xx, yy] = c
    walls = G[:, :, 1:h + 1].any(axis=2)
    G[:, :, h + 1] = np.where(walls, cap, EMPTY)
    return G, Q, rots


def render2(G, az_deg, el_deg, dist, res=520, fov_deg=None, step=0.25, light="mixed", blur=0.8, noise=6, seed=0, ctr_z=0.0, bg=0.82):
    X, Y, Z = G.shape
    ctr = np.array([X / 2, Y / 2, ctr_z])
    az, el = np.radians(az_deg), np.radians(el_deg)
    dirc = np.array([np.sin(az) * np.cos(el), np.cos(az) * np.cos(el), np.sin(el)])
    C = ctr + dist * dirc
    f = ctr - C; f /= np.linalg.norm(f)
    up_w = np.array([0, 0, 1.0]) if el_deg < 89 else np.array([0, 1.0, 0])
    r = np.cross(f, up_w); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    if fov_deg is None:
        fov_deg = 2 * np.degrees(np.arctan((X * 0.75) / dist))
    th = np.tan(np.radians(fov_deg / 2))
    s = np.linspace(-th, th, res)
    PX, PY = np.meshgrid(s, -s)
    D = f[None, None, :] + PX[..., None] * r + PY[..., None] * u
    D = D.reshape(-1, 3); D /= np.linalg.norm(D, axis=1, keepdims=True)
    Lt = np.array([0.3, 0.2, 1.0]); Lt /= np.linalg.norm(Lt)
    out = np.full(len(D), bg)
    # exact ray / bounding-box intersection (slab method) -> only march inside the tile volume
    with np.errstate(divide="ignore", invalid="ignore"):
        inv = 1.0 / D
        t1 = (0.0 - C) * inv
        t2 = (np.array([X, Y, Z], float) - C) * inv
    tmin = np.nanmax(np.minimum(t1, t2), axis=1)
    tmax = np.nanmin(np.maximum(t1, t2), axis=1)
    valid = np.where((tmax > tmax * 0 + np.maximum(tmin, 0)))[0]
    tmin = np.maximum(tmin, 0)
    budget = 1_500_000                            # samples per chunk (memory cap)
    pos = 0
    while pos < len(valid):
        # grow chunk until its sample budget is reached
        span_max, end = 0.0, pos
        while end < len(valid):
            sm = max(span_max, tmax[valid[end]] - tmin[valid[end]])
            if (end - pos + 1) * (sm / step + 2) > budget and end > pos:
                break
            span_max, end = sm, end + 1
        idx = valid[pos:end]; pos = end
        d = D[idx]
        t_in = tmin[idx]
        nsteps = int(np.ceil(span_max / step)) + 2
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
        diff = I[rows, first] - I[rows, np.maximum(first - 1, 0)]
        nrm = np.zeros((len(d), 3))
        ax = np.argmax(np.abs(diff), axis=1)
        nrm[rows, ax] = -np.sign(diff[rows, ax])
        nrm[(np.abs(diff).sum(1) == 0)] = [0, 0, 1]
        top = np.clip(nrm @ Lt, 0, 1)
        head = np.clip((nrm * -d).sum(1), 0, 1)
        if light == "overhead":
            shade = 0.45 + 0.55 * top
        elif light == "flash":
            shade = 0.3 + 0.7 * head
        else:
            shade = 0.4 + 0.3 * top + 0.3 * head
        alb = np.where(c == BLACK, 0.07, 0.92)
        out[idx] = np.where(anyhit, alb * shade, bg)
    img = (out.reshape(res, res) * 255).astype(np.uint8)
    im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(im).astype(np.float32) + np.random.default_rng(seed).normal(0, noise, (res, res))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def check(im, expect, all_links):
    zb, zx = read(im)
    got = set(zb) | {t for t, _ in zx}
    ok = expect in got
    cross = got - {expect}
    mir = any(m for t, m in zx if t == expect)
    return ok, cross, mir


def orientation_of(im, Qv):
    """Sample the decoded symbol's module grid (via zxing corner homography) and find which of the
       8 dihedral transforms of the intended matrix it matches. Returns ('rot'|'mirror', agreement)."""
    import cv2, zxingcpp
    n = Qv.shape[0]
    res = [r for r in zxingcpp.read_barcodes(im) if r.valid]
    if not res:
        return None
    p = res[0].position
    src = np.float32([[p.top_left.x, p.top_left.y], [p.top_right.x, p.top_right.y],
                      [p.bottom_right.x, p.bottom_right.y], [p.bottom_left.x, p.bottom_left.y]])
    dst = np.float32([[0, 0], [n, 0], [n, n], [0, n]])
    H = cv2.getPerspectiveTransform(dst, src)
    g = (np.arange(n) + 0.5)
    U, V = np.meshgrid(g, g)
    pts = np.stack([U.ravel(), V.ravel(), np.ones(n * n)], 1) @ H.T
    pts = pts[:, :2] / pts[:, 2:]
    a = np.asarray(im).astype(float)
    xs = np.clip(pts[:, 0].round().astype(int), 0, a.shape[1] - 1)
    ys = np.clip(pts[:, 1].round().astype(int), 0, a.shape[0] - 1)
    vals = a[ys, xs].reshape(n, n)
    S = vals < (vals.max() + vals.min()) / 2
    best = None
    for mir in (False, True):
        B = Qv[:, ::-1] if mir else Qv
        for k in range(4):
            agr = (np.rot90(B, k) == S).mean()
            if best is None or agr > best[1]:
                best = ("mirror" if mir else "rot", agr)
    return best
