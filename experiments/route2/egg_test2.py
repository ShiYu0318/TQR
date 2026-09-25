import numpy as np, sys
from tqr.qr3 import qr_matrix
from tqr.eggcrate import *
from tqr.paths import FIGURES
links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "S": "https://s.gd/sou2",
         "E": "https://s.gd/eas3", "W": "https://s.gd/wes4"}
Q = {v: qr_matrix(l) for v, l in links.items()}
az_of = {"N": 0, "E": 90, "S": 180, "W": 270}
for h in (8, 10):
  for cap in (BLACK, WHITE):
    G = build_tile(Q, p=10, h=h, cap=cap, corner=cap)
    res = []
    for v, el in [("T", 90), ("N", 35), ("E", 35), ("S", 35), ("W", 35)]:
        im = render(G, az_of.get(v, 0), el, 300 / 0.4)
        if h == 8 and cap == BLACK: im.save(FIGURES / f"egg2_{v}.png")
        zb, zx = read(im)
        got = set(zb) | {t for t, _ in zx}
        mir = [m for t, m in zx]
        res.append(("OK" if links[v] in got else "--") + ("" if got <= {links[v]} else f"!{got}") + ("(mirrored)" if any(mir) else ""))
    print(f"h={h} cap={'black' if cap==BLACK else 'white'}: T/N/E/S/W =", res)
