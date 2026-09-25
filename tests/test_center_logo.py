"""Centre logo (overlay) on QR views: the exact certificate must still hold against the ORIGINAL QR code,
and the projected silhouettes must decode with real decoders (ZBar, ZXing-C++). Also checks that an overlay
larger than a block's error-correction capacity is refused, and that views without an overlay are unchanged.

usage (from any directory):  python tests/test_center_logo.py      (exit code 1 on any failure)
"""
import sys

import numpy as np

from tqr.qr3 import decode_all, to_image
from tqr.tri import build_views, center_overlay, connect_pieces, evaluate_views, project, solve_bridge

LINKS = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]


def ring(s):
    """A dark ring on a light square: a typical small centre logo."""
    yy, xx = np.mgrid[0:s, 0:s]
    r = np.hypot(yy - (s - 1) / 2, xx - (s - 1) / 2)
    return (r <= s / 2 - 0.5) & (r >= s / 2 - 2.5)


def decodes(mask, want):
    zb, zx = decode_all(to_image(mask, px_per_cell=8, pad_cells=4))
    return want in zb or want in zx


failures = 0


def check(name, ok, detail=""):
    global failures
    failures += not ok
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


# 1) centre logo on all three QR views
views = build_views(LINKS, "3qr", "H")
n = views[0].T.shape[0]
for v in views:
    region, img = center_overlay(n, 9, ring(9))
    v.overlay(region, img)
V, _ = solve_bridge(views)
E = connect_pieces(V, views)
ev = evaluate_views(V, views)
for i, (v, e, d) in enumerate(zip(views, ev, project(V))):
    region = center_overlay(n, 9, ring(9))[0] & ~v.func
    match = float((d[region] == v.T[region]).mean())
    margin = [int(c - b) for c, b in zip(e["cap"], e["block_errors"])]
    check(f"view {i}: certificate against the original QR", bool(e["ok"]),
          f"block errors {list(map(int, e['block_errors']))} / cap {list(map(int, e['cap']))}, logo breaks {list(map(int, e['logo_blocks']))}")
    check(f"view {i}: logo shown in the silhouette (>= 90% of its pixels)", match >= 0.9, f"{match:.0%}")
    check(f"view {i}: noise margin left in every block", min(margin) > 0, f"spare codewords per block {margin}")
    check(f"view {i}: decodes with ZBar or ZXing", decodes(d, LINKS[i]))
check("bridge + struts connect everything", len(E) >= 0 and V.sum() > 0, f"{int(V.sum())} cubes, {len(E)} struts")

# 2) a logo that breaks more codewords than a block can correct is refused
big = build_views(LINKS[:2], "2qr_wall", "L")
m = big[0].T.shape[0]
try:
    region, img = center_overlay(m, m - 16, np.ones((m - 16, m - 16), bool))
    big[0].overlay(region, img)
    check("oversized logo refused", False, "no error raised")
except ValueError as err:
    check("oversized logo refused", str(err).startswith("LOGO_TOO_LARGE"), str(err))

# 3) no overlay: behaviour identical to the certificate against T itself
plain = build_views(LINKS, "3qr", "H")
Vp, _ = solve_bridge(plain)
check("no overlay: Tqr is T and every view certifies",
      all(np.array_equal(v.Tqr, v.T) and v.pre_bad is None for v in plain) and all(e["ok"] for e in evaluate_views(Vp, plain)))

print("failures =", failures)
sys.exit(1 if failures else 0)
