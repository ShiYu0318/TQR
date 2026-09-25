"""Write tests/fixtures/js_ref_levels.json: the parts of the QR structure map that depend on the
error-correction level (codeword index, block of each codeword, correctable errors per block),
for every level and a spread of versions. tests/jstest.js checks the JS port against it.

usage (from any directory):  python tests/make_level_ref.py
"""
import json
from pathlib import Path

from tqr.qrstruct import structure

VERSIONS = [1, 2, 3, 5, 7, 10]
LEVELS = "LMQH"
OUT = Path(__file__).resolve().parent / "fixtures" / "js_ref_levels.json"

ref = {}
for v in VERSIONS:
    for lv in LEVELS:
        S = structure(v, lv)
        ref[f"{v}{lv}"] = {"cw": [int(x) for x in S["cw"].ravel()],
                           "blk": [int(x) for x in S["blk"]],
                           "cap": [int(x) for x in S["cap"]]}
OUT.write_text(json.dumps(ref, separators=(",", ":")))
print(f"wrote {OUT} ({len(ref)} structures, {OUT.stat().st_size // 1024} KB)")
