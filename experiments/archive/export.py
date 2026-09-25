"""Export printable meshes.
  egg-crate tile  -> two aligned STLs (white body, black body) for multi-material FDM
  silhouette sculpture -> single STL (research artefact; resin / SLS)
"""
import numpy as np
from stl import mesh as stlmesh
from tqr.qr3 import exposed_faces_mesh
from tqr.eggcrate import WHITE, BLACK
from tqr.paths import DATA, MODELS


def save_stl(tris, path):
    m = stlmesh.Mesh(np.zeros(len(tris), dtype=stlmesh.Mesh.dtype))
    m.vectors[:] = tris
    m.save(path)
    return len(tris)


if __name__ == "__main__":
    G = np.load(DATA / "egg_G.npy")
    module_mm, p = 5.0, 12
    vox = module_mm / p
    base = 3                                   # extra white base plate under the coloured floor
    Gz = np.concatenate([np.full(G.shape[:2] + (base,), WHITE, np.uint8), G], axis=2)
    for col, name in ((WHITE, "white"), (BLACK, "black")):
        tris = exposed_faces_mesh(Gz == col, scale=vox)
        n = save_stl(tris, MODELS / f"fiveview_tile_{name}.stl")
        print(f"fiveview_tile_{name}.stl: {n} triangles")
    ext = np.array(Gz.shape) * vox
    print(f"tile size: {ext[0]:.1f} x {ext[1]:.1f} x {ext[2]:.2f} mm, wall skin {vox:.3f} mm, wall height {10*vox:.2f} mm")

    F = np.load(DATA / "F_best.npy")
    tris = exposed_faces_mesh(F, scale=3.0 / 5)
    print(f"silhouette_sculpture.stl: {save_stl(tris, MODELS / 'silhouette_sculpture.stl')} triangles, "
          f"size {F.shape[0]*0.6:.1f} mm cube, strut 0.6 mm")
