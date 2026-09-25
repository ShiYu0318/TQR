import time, numpy as np
from tqr.tri import *
links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
for allow in ((), (2, 3, 4)):
    views = build_views(links, "3qr", budget_frac=0.5, allow_func=allow)
    t = time.time()
    V, info = solve_bridge(views, verbose=True)
    E = connect_pieces(V, views)
    print(f"allow_func={allow}: {info} struts_to_join={len(E)}  {time.time()-t:.1f}s")
    for e in evaluate_views(V, views):
        print("    ok", e["ok"], "func_err", e.get("func_errors"), "blocks", list(e.get("block_errors", [])), "budget", list(e.get("budget", [])), "cap", list(e.get("cap", [])))
