"""Write tests/fixtures/js_ref_overlay.json: a centre-logo overlay on the demo QR codes and what Python derives
from it (codewords the logo breaks per block, resulting block budgets). tests/jstest.js checks the JS port against it.

usage (from any directory):  python tests/make_overlay_ref.py
"""
import json
from pathlib import Path

import numpy as np

from tqr.tri import build_views, center_overlay

LINKS = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
OUT = Path(__file__).resolve().parent / "fixtures" / "js_ref_overlay.json"
SIZE = 9


def ring(s):
    yy, xx = np.mgrid[0:s, 0:s]
    r = np.hypot(yy - (s - 1) / 2, xx - (s - 1) / 2)
    return (r <= s / 2 - 0.5) & (r >= s / 2 - 2.5)


views = build_views(LINKS, "3qr", "H", budget_frac=0.5)
n = views[0].T.shape[0]
region, img = center_overlay(n, SIZE, ring(SIZE))
qr = [v.T.astype(int).ravel().tolist() for v in views]
for v in views:
    v.overlay(region, img)
ref = {"version": int(views[0].S["version"]), "budget": 0.5, "qr": qr,
       "region": region.astype(int).ravel().tolist(), "pixels": img.astype(int).ravel().tolist(),
       "logo_blocks": [v.pre_blk.tolist() for v in views], "block_budget": [v.budget.tolist() for v in views]}
OUT.write_text(json.dumps(ref, separators=(",", ":")))
print(f"wrote {OUT}: logo breaks {ref['logo_blocks']}, budgets {ref['block_budget']}")
