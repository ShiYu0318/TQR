"""Five-view tile: how the wall aspect ratio h/g shifts the readable elevation bands."""
from qr3 import qr_matrix
from egg2 import build_tile2, render2
from eggcrate import read

links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "S": "https://s.gd/sou2", "E": "https://s.gd/eas3", "W": "https://s.gd/wes4"}
Q0 = {v: qr_matrix(l) for v, l in links.items()}
for h in (6, 10, 14):
    G, Q, _ = build_tile2(Q0, p=12, h=h)
    side = ""
    for el in (20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70):
        zb, zx = read(render2(G, 0, el, 300 / (4.0 / 12), res=480))
        got = set(zb) | {x for x, _ in zx}
        side += "O" if links["N"] in got else ("x" if got else ".")
    top = ""
    for tilt in (0, 10, 20, 25, 30):
        zb, zx = read(render2(G, 0, 90 - tilt if tilt else 90, 300 / (4.0 / 12), res=480))
        got = set(zb) | {x for x, _ in zx}
        top += "O" if links["T"] in got else ("x" if got else ".")
    print(f"wall h/g = {h/10:.1f}: north view el 20..70 step5 = {side}   top tilt 0/10/20/25/30 = {top}")
