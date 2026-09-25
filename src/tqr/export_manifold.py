"""Watertight export: greedy 3-D box decomposition of a voxel mask, exact union with manifold3d."""
import numpy as np, time, sys
import manifold3d as mf
import trimesh
from .eggcrate import WHITE, BLACK
from .paths import DATA, MODELS


def boxes_from_mask(M):
    M = M.copy()
    X, Y, Z = M.shape
    out = []
    # iterate z-major so thin tall walls become single tall boxes
    for x, y, z in np.argwhere(M):
        if not M[x, y, z]:
            continue
        x1 = x
        while x1 + 1 < X and M[x1 + 1, y, z]:
            x1 += 1
        y1 = y
        while y1 + 1 < Y and M[x:x1 + 1, y1 + 1, z].all():
            y1 += 1
        z1 = z
        while z1 + 1 < Z and M[x:x1 + 1, y:y1 + 1, z1 + 1].all():
            z1 += 1
        M[x:x1 + 1, y:y1 + 1, z:z1 + 1] = False
        out.append((x, y, z, x1 + 1, y1 + 1, z1 + 1))
    return out


def mask_to_mesh(M, scale):
    bx = boxes_from_mask(M)
    e = 1e-4  # mm: make face-sharing boxes overlap so the union fuses them into one shell
    parts = [mf.Manifold.cube([(b[3] - b[0]) * scale + 2 * e, (b[4] - b[1]) * scale + 2 * e, (b[5] - b[2]) * scale + 2 * e])
             .translate([b[0] * scale - e, b[1] * scale - e, b[2] * scale - e]) for b in bx]
    u = mf.Manifold.batch_boolean(parts, mf.OpType.Add)
    m = u.to_mesh()
    tm = trimesh.Trimesh(vertices=np.asarray(m.vert_properties)[:, :3], faces=np.asarray(m.tri_verts), process=False)
    return tm, len(bx), len(u.decompose())


if __name__ == "__main__":
    t = time.time()
    G = np.load(DATA / "egg_G.npy")
    vox = 5.0 / 12
    Gz = np.concatenate([np.full(G.shape[:2] + (3,), WHITE, np.uint8), G], axis=2)
    for col, name in ((WHITE, "white"), (BLACK, "black")):
        tm, nb, npc = mask_to_mesh(Gz == col, vox)
        tm.export(str(MODELS / f"fiveview_tile_{name}.stl"))
        print(f"{name}: boxes={nb} tris={len(tm.faces)} watertight={tm.is_watertight} "
              f"volume={tm.volume/1000:.2f} cm3 pieces={npc} ({time.time()-t:.0f}s)", flush=True)
    F = np.load(DATA / "F_best.npy")
    tm, nb, npc = mask_to_mesh(F, 0.6)
    tm.export(str(MODELS / "silhouette_sculpture.stl"))
    print(f"silhouette: boxes={nb} tris={len(tm.faces)} watertight={tm.is_watertight} volume={tm.volume/1000:.2f} cm3 "
          f"pieces={npc} ({time.time()-t:.0f}s)")
