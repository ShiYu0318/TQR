import numpy as np
from tqr.qr3 import qr_matrix
from tqr.egg2 import *
from tqr.eggcrate import read
from tqr.paths import FIGURES
links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "S": "https://s.gd/sou2",
         "E": "https://s.gd/eas3", "W": "https://s.gd/wes4"}
Q0 = {v: qr_matrix(l) for v, l in links.items()}
for p, h in ((10, 8), (12, 10)):
    for align, vote in ((True, False), (True, True)):
        G, Q, rots = build_tile2(Q0, p=p, h=h, align=align, vote=vote)
        for light in ("overhead", "mixed"):
            res = []
            for v, el in [("T", 90), ("N", 35), ("E", 35), ("S", 35), ("W", 35)]:
                im = render2(G, AZ.get(v, 0), el, 300 / (4.0 / p), light=light)
                if p == 10 and vote and light == "mixed": im.save(FIGURES / f"egg3_{v}.png")
                zb, zx = read(im)
                got = set(zb) | {t for t, _ in zx}
                ok = links[v] in got
                o = orientation_of(im, Q[v]) if any(t == links[v] for t, _ in zx) else None
                res.append(("OK" if ok else "--") + (f"({o[0]})" if o else "") + ("!X" if got - {links[v]} else ""))
            print(f"pitch={p} h={h} vote={vote} light={light:8s}: T/N/E/S/W = {res}")
