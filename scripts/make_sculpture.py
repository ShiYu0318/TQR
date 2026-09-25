"""Generate a tri-view silhouette QR sculpture and export a watertight STL.

usage:
  python scripts/make_sculpture.py --mode 3qr --method bridge+strut URL_TOP URL_FRONT URL_SIDE
  python scripts/make_sculpture.py --mode 2qr_wall --method bridge+strut URL_TOP URL_FRONT
  python scripts/make_sculpture.py --mode 2qr_logo --logo heart --method bridge+strut URL_TOP URL_FRONT
options: --budget 0.5  --boost 0  --module-mm 3  --strut 0.2  --relaxed
methods: strut | bridge+strut | bridge | free | dust   (bridge / free give several separate pieces)
"""
import argparse, json
import numpy as np
from tqr.tri import build_views, solve_strut, solve_bridge, connect_pieces, solve_free_greedy, feasible_set, evaluate_views, components, strut_fine
from tqr.export_manifold import mask_to_mesh

ap = argparse.ArgumentParser()
ap.add_argument("links", nargs="+")
ap.add_argument("--mode", default="3qr", choices=["3qr", "2qr_wall", "2qr_logo"])
ap.add_argument("--method", default="bridge+strut", choices=["strut", "bridge+strut", "bridge", "free", "dust"])
ap.add_argument("--logo", default="heart", choices=["heart", "star", "ring", "text"])
ap.add_argument("--budget", type=float, default=0.5)
ap.add_argument("--boost", type=int, default=0)
ap.add_argument("--module-mm", type=float, default=3.0)
ap.add_argument("--strut", type=float, default=0.2, help="strut width as a fraction of the module")
ap.add_argument("--relaxed", action="store_true")
ap.add_argument("--out", default="sculpture.stl")
a = ap.parse_args()

views = build_views(a.links, a.mode, budget_frac=a.budget, logo_kind=a.logo, version_boost=a.boost,
                    allow_func=(2, 3, 4) if a.relaxed else ())
E = np.zeros((0, 2), int)
if a.method == "strut":
    V, E, _ = solve_strut(views)
elif a.method.startswith("bridge"):
    V, _ = solve_bridge(views)
    if a.method == "bridge+strut":
        E = connect_pieces(V, views)
elif a.method == "free":
    V = solve_free_greedy(views)
else:
    V = feasible_set(views)

k = max(2, int(round(1 / a.strut)))          # strut = 1 fine voxel of k per module
F = strut_fine(V, E, k) if len(E) else np.kron(V, np.ones((k, k, k), bool))
tm, nboxes, npieces = mask_to_mesh(F, a.module_mm / k)
tm.export(a.out)
ev = evaluate_views(V, views)
report = {
    "out": a.out, "qr_version": int(views[0].S["version"]), "size_mm": round(V.shape[0] * a.module_mm, 1),
    "cubes": int(V.sum()), "struts": int(len(E)), "printed_pieces": int(npieces), "watertight": bool(tm.is_watertight),
    "certified": [bool(e["ok"]) for v, e in zip(views, ev) if v.kind == "qr"],
    "block_errors": [list(map(int, e["block_errors"])) + ["/"] + list(map(int, e["cap"])) for v, e in zip(views, ev) if v.kind == "qr"],
}
print(json.dumps(report, ensure_ascii=False))
