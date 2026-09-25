"""Ablation harness: every method x view-mode gets the same checks."""
import time, json, sys, random, string
import numpy as np
from PIL import Image, ImageFilter
from tqr.tri import *
from tqr.qr3 import decode_all
from tqr.paths import DATA

METHODS = ["dust", "strut", "bridge", "bridge+strut", "bridge_relaxed", "bridge_relaxed+strut", "free_greedy", "free_milp"]


def img(mask, px, pad, blur):
    a = np.where(mask, 0, 255).astype(np.uint8)
    im = Image.fromarray(a).resize((mask.shape[1] * px, mask.shape[0] * px), Image.NEAREST)
    c = Image.new("L", (im.width + 2 * pad * px, im.height + 2 * pad * px), 255)
    c.paste(im, (pad * px, pad * px))
    return c.filter(ImageFilter.GaussianBlur(blur)) if blur else c


def decode_views(V, E, views, links, k=5):
    """Orthographic decode of each QR view: fine model when struts exist."""
    if len(E):
        F = strut_fine(V, E, k)
        P = project(F); px, pad = 2, 4 * k
    else:
        P = project(V); px, pad = 10, 4
    res = []
    qi = 0
    for vi, v in enumerate(views):
        if v.kind != "qr":
            res.append(None); continue
        link = links[qi]; qi += 1
        ok = []
        for blur in (0.8 * px / 2, 1.6 * px / 2):
            zb, zx = decode_all(img(P[vi], px, pad, blur))
            ok.append((link in zb) or (link in zx))
        res.append(any(ok))
    return res


def run(links, mode="3qr", method="bridge", budget=0.5, boost=0, logo_kind="heart", logo_budget=0.1, rots=(0, 0, 0),
        milp_time=60):
    relaxed = method.startswith("bridge_relaxed")
    views = build_views(links, mode, budget_frac=budget, logo_kind=logo_kind, logo_budget=logo_budget,
                        allow_func=(2, 3, 4) if relaxed else (), rots=rots, version_boost=boost)
    t = time.time()
    E = np.zeros((0, 2), int)
    info = {}
    if method == "dust":
        V = feasible_set(views)
    elif method == "strut":
        V, E, info = solve_strut(views)
    elif method.startswith("bridge"):
        V, info = solve_bridge(views)
        if method.endswith("+strut"):
            E = connect_pieces(V, views)
    elif method == "free_greedy":
        V = solve_free_greedy(views)
    elif method == "free_milp":
        V, info = solve_free_milp(views, time_limit=milp_time)
    dt = time.time() - t
    ev = evaluate_views(V, views)
    pieces, share = components(V)
    dec = decode_views(V, E, views, [l for l in links])
    qr_ev = [e for v, e in zip(views, ev) if v.kind == "qr"]
    out = {
        "mode": mode, "method": method, "n": int(views[0].T.shape[0]), "version": int(views[0].S["version"]),
        "cubes": int(V.sum()), "struts": int(len(E)),
        "pieces_cubes_only": pieces, "main_share": round(share, 3),
        "one_piece": bool(pieces == 1 or len(E) > 0),
        "certified": all(e["ok"] for v, e in zip(views, ev) if v.kind == "qr"),
        "func_damage": int(sum(e.get("func_errors", 0) for e in qr_ev)),
        "worst_block_use": float(max((e["block_errors"] / np.maximum(e["cap"], 1)).max() for e in qr_ev)),
        "decoded": [d for d in dec if d is not None],
        "third_view": None if mode == "3qr" else {k: v for k, v in ev[2].items() if k != "ok"},
        "bridges": info.get("bridges"), "time_s": round(dt, 2),
    }
    out["decode_all"] = all(out["decoded"])
    return out, V, E, views


def random_links(rng, k=3):
    hosts = ["s.gd", "bit.ly", "gdg.community.dev", "ncu.edu.tw", "github.com", "example.org", "forms.gle"]
    out = []
    for _ in range(k):
        L = rng.choice([4, 6, 10, 16, 24, 36])
        out.append(f"https://{rng.choice(hosts)}/" + "".join(rng.choice(string.ascii_letters + string.digits) for _ in range(L)))
    return out


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "demo"
    if what == "demo":
        links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
        rows = []
        for mode in ("3qr", "2qr_wall", "2qr_logo"):
            for m in METHODS:
                r, *_ = run(links, mode, m)
                rows.append(r)
                print(json.dumps({k: r[k] for k in ("mode", "method", "cubes", "struts", "pieces_cubes_only", "main_share",
                                                    "one_piece", "certified", "func_damage", "decoded", "worst_block_use", "time_s")}), flush=True)
        json.dump(rows, open(DATA / "ablate_demo.json", "w"), indent=1, default=str)
