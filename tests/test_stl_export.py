"""STL export must stay watertight AFTER a write/read round trip (the check `scripts/stl_check.py` does), not only in
memory. Builds the demo bridge+strut sculpture and a thin-walled test block, exports STL, reads it back.

usage (from any directory):  python tests/test_stl_export.py      (exit code 1 on any failure)
"""
import io
import sys

import numpy as np
import trimesh

from tqr.export_manifold import mask_to_mesh
from tqr.tri import build_views, connect_pieces, solve_bridge, strut_fine

failures = 0


def round_trip(name, M, scale):
    global failures
    tm, boxes, pieces = mask_to_mesh(M, scale)
    buf = io.BytesIO()
    tm.export(buf, file_type="stl")
    buf.seek(0)
    back = trimesh.load(buf, file_type="stl")
    exact = M.sum() * scale ** 3
    ok = back.is_watertight and len(back.split(only_watertight=False)) == pieces and abs(back.volume - exact) / exact < 0.02
    failures += not ok
    print(("PASS " if ok else "FAIL ") + f"{name}: {boxes} boxes, {len(back.faces)} triangles, watertight after STL read {back.is_watertight}, "
          f"bodies {len(back.split(only_watertight=False))} (union {pieces}), volume +{(back.volume - exact) / exact * 100:.2f}%")


views = build_views(["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"], "3qr", "H")
V, _ = solve_bridge(views)
E = connect_pieces(V, views)
round_trip("demo sculpture (bridge + struts)", strut_fine(V, E, 5), 3.0 / 5)

# thin walls touching along edges and corners: the case that used to fall apart
rng = np.random.default_rng(0)
block = rng.random((24, 24, 8)) < 0.35
block[:, :, 0] = True
round_trip("random thin-walled block", block, 0.4)

print("failures =", failures)
sys.exit(1 if failures else 0)
