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


def weld_float32(vertices, faces):
    """Weld vertices that share a float32 position (as an STL reader does) and drop triangles that collapse.
    Returns (vertices, faces, closed) where closed means every edge is shared by exactly two triangles."""
    key = np.asarray(vertices, np.float32)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    f = inv.ravel()[np.asarray(faces)]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    e = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), axis=1)
    _, counts = np.unique(e, axis=0, return_counts=True)
    return uniq.astype(np.float64), f, bool((counts == 2).all())


def mask_to_mesh(M, scale):
    """Exact union of the mask's boxes. Face-sharing boxes overlap by e so the union fuses them; STL stores float32
    positions without vertex indices, so the mesh is welded the way a reader would, and e grows until that welded
    mesh is closed (1e-4 mm, the old value, left sub-float32 slivers that fell apart when the STL was read back)."""
    bx = boxes_from_mask(M)
    for e in (2e-3, 5e-3, 1e-2):  # mm
        parts = [mf.Manifold.cube([(b[3] - b[0]) * scale + 2 * e, (b[4] - b[1]) * scale + 2 * e, (b[5] - b[2]) * scale + 2 * e])
                 .translate([b[0] * scale - e, b[1] * scale - e, b[2] * scale - e]) for b in bx]
        u = mf.Manifold.batch_boolean(parts, mf.OpType.Add)
        m = u.to_mesh()
        v, f, closed = weld_float32(np.asarray(m.vert_properties)[:, :3], np.asarray(m.tri_verts))
        if closed:
            break
    tm = trimesh.Trimesh(vertices=v, faces=f, process=False)
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
