import json, random, numpy as np, sys
from ablate import run, random_links
from tqr.paths import DATA
out = {"sweep": [], "batch": [], "milp": None}
links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
# 1) budget x version-boost sweep for the strut-free methods (3 QR views)
for method in ("bridge", "bridge_relaxed"):
    for budget in (0.5, 0.8, 1.0):
        for boost in (0, 2):
            r, *_ = run(links, "3qr", method, budget=budget, boost=boost)
            out["sweep"].append({k: r[k] for k in ("method", "version", "cubes", "pieces_cubes_only", "main_share", "certified", "decode_all", "worst_block_use", "func_damage")} | {"budget": budget, "boost": boost})
            print("sweep", out["sweep"][-1], flush=True)
json.dump(out, open(DATA / "sweep_batch.json", "w"), indent=1, default=str)
# 2) exact minimum with a longer MILP run
r, *_ = run(links, "3qr", "free_milp", milp_time=400)
out["milp"] = {k: r[k] for k in ("cubes", "certified", "decode_all", "time_s")}
print("milp", out["milp"], flush=True)
json.dump(out, open(DATA / "sweep_batch.json", "w"), indent=1, default=str)
# 3) random-link batch
rng = random.Random(7)
for t in range(15):
    L = random_links(rng)
    for mode in ("3qr", "2qr_wall", "2qr_logo"):
        for method in ("strut", "bridge+strut", "bridge_relaxed+strut", "free_greedy"):
            try:
                r, *_ = run(L, mode, method)
                row = {k: r[k] for k in ("mode", "method", "version", "cubes", "struts", "pieces_cubes_only", "main_share", "certified", "decode_all", "time_s")}
            except Exception as e:
                row = {"mode": mode, "method": method, "error": repr(e)}
            row["trial"] = t; row["links"] = L
            out["batch"].append(row)
            print("batch", row, flush=True)
    json.dump(out, open(DATA / "sweep_batch.json", "w"), indent=1, default=str)
print("DONE", flush=True)
