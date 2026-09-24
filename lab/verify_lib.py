import numpy as np
def render_persp(F, axis, dist, res=420, fov_pad=1.25, step=0.5):
    """Pinhole camera on +axis side at `dist` (voxel units) from object centre, looking at centre.
       Returns silhouette image (res x res bool), image u ~ first remaining axis, v ~ second."""
    n = F.shape[0]
    ctr = np.array([n / 2] * 3)
    a1, a2 = [a for a in range(3) if a != axis]
    cam = ctr.copy(); cam[axis] += dist
    half = (n / 2) * fov_pad / (dist - n / 2)  # tan half-angle so the near face fits
    us = np.linspace(-half, half, res)
    U, W = np.meshgrid(us, us, indexing="ij")
    d = np.zeros((res * res, 3)); d[:, axis] = -1; d[:, a1] = U.ravel(); d[:, a2] = W.ravel()
    t0, t1 = dist - n / 2 - 1, dist + n / 2 + 1
    ts = np.arange(t0, t1, step)
    out = np.zeros(res * res, dtype=bool)
    for s in range(0, res * res, 4000):
        dd = d[s:s + 4000]
        P = cam[None, None, :] + dd[:, None, :] * ts[None, :, None]
        I = np.floor(P).astype(int)
        inside = np.all((I >= 0) & (I < n), axis=2)
        I = np.clip(I, 0, n - 1)
        hit = F[I[..., 0], I[..., 1], I[..., 2]] & inside
        out[s:s + 4000] = hit.any(1)
    return out.reshape(res, res)

