"""Enclosure lemma, measured: how many sealed regions remain when bridges may darken
white modules of selected function-pattern classes (1 finder, 2 separator, 3 timing, 4 alignment).
Also searches the 64 rotation combos for the fewest sealed regions (strict case)."""
import itertools
import numpy as np
from scipy import ndimage
from tqr.tri import build_views, feasible_set, S6, View
from tqr.qrstruct import function_classes

NAMES = {1: "finder", 2: "separator", 3: "timing", 4: "alignment", 5: "format", 6: "dark"}


def sealed_regions(views, Lc, allow=()):
    ok = [~(~v.T & np.isin(Lc, [k for k in NAMES if k not in allow])) for v in views]
    A = ok[0][:, :, None] & ok[1][:, None, :] & ok[2][None, :, :]
    lab, K = ndimage.label(A, structure=S6)
    Vf = feasible_set(views)
    return len([c for c in range(1, K + 1) if (Vf & (lab == c)).any()])


if __name__ == "__main__":
    links = ["https://s.gd/aaa1", "https://s.gd/bbb2", "https://s.gd/ccc3"]
    views = build_views(links, "3qr")
    Lc = function_classes(views[0].S["version"])
    for allow in ((), (3,), (2, 3), (2, 3, 4), (2, 3, 4, 1)):
        print("darkening allowed on", [NAMES[a] for a in allow] or "nothing", "->", sealed_regions(views, Lc, allow))
    best = None
    for r in itertools.product(range(4), repeat=3):
        vs = build_views(links, "3qr", rots=r)
        # rotate class maps with each view
        ok = [~(~v.T & np.isin(np.rot90(Lc, r[i]), [1, 2, 3, 4, 5, 6])) for i, v in enumerate(vs)]
        A = ok[0][:, :, None] & ok[1][:, None, :] & ok[2][None, :, :]
        lab, K = ndimage.label(A, structure=S6)
        Vf = feasible_set(vs)
        k = len([c for c in range(1, K + 1) if (Vf & (lab == c)).any()])
        if best is None or k < best[0]:
            best = (k, r)
    print("fewest sealed regions over 64 rotation combos (strict):", best)
