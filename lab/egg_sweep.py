import numpy as np, json, sys
from qr3 import qr_matrix
from egg2 import *
from eggcrate import read
links = {"T": "https://s.gd/top5", "N": "https://s.gd/nor1", "S": "https://s.gd/sou2",
         "E": "https://s.gd/eas3", "W": "https://s.gd/wes4"}
G = np.load("egg_G.npy")
dist = 300 / (4.0 / 12)   # 30 cm, module 4 mm
views = sys.argv[1].split(",")
out = {}
for v in views:
    grid = {}
    if v == "T":
        for tilt in (0, 5, 10, 15, 20, 25, 30):
            for az in (0, 45, 90):
                im = render2(G, az, 90 - tilt if tilt else 90, dist, res=480, light="mixed")
                zb, zx = read(im); got = set(zb) | {t for t, _ in zx}
                grid[f"{tilt},{az}"] = [links[v] in got, sorted(got - {links[v]})]
    else:
        for el in (15, 20, 25, 30, 35, 40, 45, 50, 55, 60):
            for daz in (-30, -20, -10, 0, 10, 20, 30):
                im = render2(G, AZ[v] + daz, el, dist, res=480, light="mixed")
                zb, zx = read(im); got = set(zb) | {t for t, _ in zx}
                grid[f"{el},{daz}"] = [links[v] in got, sorted(got - {links[v]})]
    out[v] = grid
    print(v, "done", sum(g[0] for g in grid.values()), "/", len(grid), flush=True)
json.dump(out, open(f"sweep_{'_'.join(views)}.json", "w"))
