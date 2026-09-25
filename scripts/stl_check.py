"""Printability checks for exported STLs and voxel models: watertightness, winding, volume, pieces, enclosed voids."""
import sys
import numpy as np
import trimesh
from scipy import ndimage
from tqr.paths import DATA, MODELS

def check_stl(path):
    tm = trimesh.load(path)   # STL has no shared vertices: they must be merged (process=True) before any topology check
    print(f"{path}: watertight={tm.is_watertight} winding={tm.is_winding_consistent} bodies={len(tm.split(only_watertight=False))} volume={tm.volume/1000:.2f} cm3 tris={len(tm.faces)}")

def check_voids(npy):
    F = np.load(npy)
    lab, n = ndimage.label(~F)
    border = set(np.unique(np.concatenate([lab[0].ravel(), lab[-1].ravel(), lab[:, 0].ravel(), lab[:, -1].ravel(), lab[:, :, 0].ravel(), lab[:, :, -1].ravel()])))
    voids = [c for c in range(1, n + 1) if c not in border]
    pieces = ndimage.label(F, structure=ndimage.generate_binary_structure(3, 1))[1]
    print(f"{npy}: face-connected pieces={pieces} enclosed voids={len(voids)}")

if __name__ == "__main__":
    for p in sys.argv[1:] or [MODELS / "silhouette_sculpture.stl", MODELS / "fiveview_tile_white.stl", MODELS / "fiveview_tile_black.stl",
                              MODELS / "sculpture_bridge_strut.stl", MODELS / "sculpture_2qr_wall.stl"]:
        check_stl(p)
    check_voids(DATA / "F_best.npy")
