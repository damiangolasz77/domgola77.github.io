# Build a triangle mesh + sphere-chain collider of the inflated G from the baked Poisson field.
import json, gzip, base64, numpy as np
from scipy import ndimage
from skimage import measure, morphology

import os
SRC = os.environ.get('GSRC', 'bake/logo-field')   # folder with h.npy + field.json from bake_field.py
OUT = os.environ.get('GOUT', 'assets/gmesh.json')
h = np.load(SRC + '/h.npy')          # svg units², +inside
meta = json.load(open(SRC + '/field.json'))
N = h.shape[0]; DX = meta['span'] / N
K2 = float(os.environ.get('GK2', '2.0'))              # 2 = circular tube, lower = flatter pillow
SP = float(__import__('sys').argv[1]) if len(__import__('sys').argv) > 1 else 1.3   # mesh grid spacing (svg units)
inside = h > 0
ys, xs = np.nonzero(inside)
x0, x1 = xs.min() - 6, xs.max() + 6; y0, y1 = ys.min() - 6, ys.max() + 6
zmax = np.sqrt(K2 * h.max()) + 2
gx = np.arange(x0 * DX, x1 * DX, SP); gy = np.arange(y0 * DX, y1 * DX, SP); gz = np.arange(-zmax, zmax + SP, SP)
# smooth cubic sampling of h
GY, GX = np.meshgrid(gy, gx, indexing='ij')
hs = ndimage.map_coordinates(h, [GY.ravel() / DX - .5, GX.ravel() / DX - .5], order=3, mode='nearest').reshape(GY.shape)
F = gz[None, None, :] ** 2 - K2 * hs[:, :, None]     # (y, x, z)
verts, faces, _, _ = measure.marching_cubes(F, 0.0, spacing=(SP, SP, SP))
import fast_simplification
TARGET = int(__import__('sys').argv[2]) if len(__import__('sys').argv) > 2 else 36000
v0 = verts.astype(np.float32); f0 = faces.astype(np.int32)
verts, faces = fast_simplification.simplify(v0, f0, target_reduction=1 - TARGET / len(f0))
vy = verts[:, 0] + gy[0]; vx = verts[:, 1] + gx[0]; vz = verts[:, 2] + gz[0]
# analytic normals from the field gradient (∇F = (-k²∇h, 2z))
hy, hx = np.gradient(h, DX)
coords = [vy / DX - .5, vx / DX - .5]
dhx = ndimage.map_coordinates(hx, coords, order=3, mode='nearest')
dhy = ndimage.map_coordinates(hy, coords, order=3, mode='nearest')
hv = ndimage.map_coordinates(h, coords, order=3, mode='nearest')
zs = np.sign(vz + 1e-9) * np.sqrt(np.maximum(K2 * hv, 0))   # project onto the true surface for the normal
n = np.stack([-K2 * dhx, -K2 * dhy, 2 * zs], 1)
n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
# to object space: centre, y up, unit scale (max radius in xy = 1)
cx, cy = (gx[0] + gx[-1]) / 2, (gy[0] + gy[-1]) / 2
P = np.stack([vx - cx, -(vy - cy), vz], 1)
Nn = np.stack([n[:, 0], -n[:, 1], n[:, 2]], 1)
S = np.abs(P[:, :2]).max()
P /= S
# (winding already matches outward normals after the y flip + marching-cubes axis order)
print('verts', len(P), 'tris', len(faces), 'scale', S)

# ---- sphere-chain collider along the stroke skeleton ----
sk = morphology.skeletonize(inside)
sy, sx = np.nonzero(sk)
r = np.sqrt(K2 * h[sy, sx])                        # tube radius (svg)
order = np.argsort(-r)
taken = []
for i in order:
    p = np.array([sx[i] * DX, sy[i] * DX]); rr = r[i]
    if rr < 4: continue
    if all(np.hypot(*(p - q[:2])) > 1.9 * max(rr, q[2]) for q in taken):
        taken.append((p[0], p[1], rr))
spheres = [[(x - cx) / S, -(y - cy) / S, rr / S] for x, y, rr in taken]
print('spheres', len(spheres))

q = np.round(P / 1.0 * 32767).astype('<i2')          # |P| ≤ 1
nq = np.round(Nn * 127).astype('<i1')
idx = faces.astype('<u4')
blob = gzip.compress(q.tobytes() + nq.tobytes() + idx.tobytes(), 9)
out = dict(nv=int(len(P)), nf=int(len(faces)), data=base64.b64encode(blob).decode(),
           spheres=[[round(v, 4) for v in s] for s in spheres], zscale=float(zmax / S))
json.dump(out, open(OUT, 'w'))
print('KB', len(blob) / 1024)
