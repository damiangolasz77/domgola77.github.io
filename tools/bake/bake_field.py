"""
Bake an SVG logo into an "inflation field" for the WebGL chrome renderer.

Output: h(x,y) on a square grid
  h > 0 inside the logo  – solution of the Poisson equation  ∇²h = -1, h = 0 on the contour
                           → z = k·sqrt(h) gives a perfectly round tube whose radius follows the
                             local stroke width (circle when k = √2), no creases anywhere
  h < 0 outside          – linear continuation (|∇h| at the edge × signed distance) so that the
                           zero contour stays exact under GPU interpolation

Pipeline: SVG path → dense polylines → raster → gaussian rounding of every corner → sub-pixel contour
→ exact SDF (KD-tree) → Shortley–Weller Poisson solve (2nd-order accurate boundary) → extension →
uint16 + 2D predictor + gzip → base64.
"""
import re, sys, json, gzip, base64
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, sparse
from scipy.sparse.linalg import spsolve
from scipy.spatial import cKDTree
from skimage import measure

SVG = sys.argv[1] if len(sys.argv) > 1 else "logo.svg"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
ROUND = float(sys.argv[3]) if len(sys.argv) > 3 else 2.2      # corner radius (svg units)
OUT = sys.argv[4] if len(sys.argv) > 4 else "field.json"

# ---------- 1. parse path (M/L/C/Z absolute) ----------
d = re.search(r' d="([^"]+)"', open(SVG).read()).group(1)
toks = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
subpaths, cur, i, pen = [], [], 0, None
def cubic(p0, p1, p2, p3, n=64):
    t = np.linspace(0, 1, n)[1:, None]
    return ((1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3)
while i < len(toks):
    c = toks[i]; i += 1
    if c == "M":
        if cur: subpaths.append(np.array(cur))
        pen = np.array([float(toks[i]), float(toks[i+1])]); i += 2; cur = [pen]
    elif c == "L":
        pen = np.array([float(toks[i]), float(toks[i+1])]); i += 2; cur.append(pen)
    elif c == "C":
        p = [np.array([float(toks[i+2*j]), float(toks[i+2*j+1])]) for j in range(3)]; i += 6
        cur.extend(cubic(pen, *p)); pen = p[2]
    elif c == "Z":
        subpaths.append(np.array(cur)); cur = []
if cur: subpaths.append(np.array(cur))
allp = np.concatenate(subpaths)
mn, mx = allp.min(0), allp.max(0)
center = (mn + mx) / 2
half = (mx - mn).max() / 2 + ROUND + 14
X0, Y0, SPAN = center[0] - half, center[1] - half, 2 * half
print("bounds", mn, mx, "span", SPAN)

# ---------- 2. fine raster (even-odd) ----------
FS = 0.15                                     # fine raster step (svg units)
FW = int(np.ceil(SPAN / FS))
img = Image.new("L", (FW, FW), 0)
for sp in subpaths:
    layer = Image.new("L", (FW, FW), 0)
    ImageDraw.Draw(layer).polygon([((x - X0) / FS, (y - Y0) / FS) for x, y in sp], fill=255)
    img = Image.fromarray(np.bitwise_xor(np.array(img), np.array(layer)))
fine = np.array(img, dtype=np.float32) / 255.0

# ---------- 3. round every corner: gaussian + 0.5 iso-contour ----------
soft = ndimage.gaussian_filter(fine, sigma=ROUND / FS)
contours = measure.find_contours(soft, 0.5)
pts = []
for c in contours:                             # (row, col) → svg units, densify to ~0.03 units
    xy = np.stack([X0 + (c[:, 1] + 0.5) * FS, Y0 + (c[:, 0] + 0.5) * FS], 1)
    seg = np.diff(xy, axis=0); L = np.hypot(*seg.T)
    for a, s, l in zip(xy[:-1], seg, L):
        n = max(1, int(np.ceil(l / 0.03)))
        pts.append(a + s * (np.arange(n)[:, None] / n))
pts = np.concatenate(pts)
print("contour points", len(pts))

# ---------- 4. exact signed distance on the bake grid ----------
DX = SPAN / N
gx = X0 + (np.arange(N) + 0.5) * DX
GX, GY = np.meshgrid(gx, Y0 + (np.arange(N) + 0.5) * DX)
dist, _ = cKDTree(pts).query(np.stack([GX.ravel(), GY.ravel()], 1), workers=-1)
dist = dist.reshape(N, N)
inside_val = ndimage.map_coordinates(soft, [((GY - Y0) / FS - 0.5).ravel(), ((GX - X0) / FS - 0.5).ravel()], order=1).reshape(N, N)
sd = np.where(inside_val > 0.5, dist, -dist)   # + inside, svg units

# ---------- 5. Poisson ∇²h = -1, Shortley–Weller boundary ----------
inside = sd > 0
idx = -np.ones((N, N), dtype=np.int64)
ys, xs = np.nonzero(inside)
idx[ys, xs] = np.arange(len(ys))
rows, cols, vals = [], [], []
diag = np.zeros(len(ys))
for (dy, dx) in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
    ny, nx = ys + dy, xs + dx
    nin = inside[ny, nx]
    # distance to neighbour or to the boundary crossing along the link
    th = np.where(nin, 1.0, sd[ys, xs] / (sd[ys, xs] - sd[ny, nx]))
    th = np.clip(th, 0.08, 1.0) * DX
    opp = np.where(inside[ys - dy, xs - dx], 1.0, np.clip(sd[ys, xs] / (sd[ys, xs] - sd[ys - dy, xs - dx]), 0.08, 1.0)) * DX
    w = 2.0 / (th * (th + opp))                # nonuniform 3-point stencil weight
    diag += w
    m = nin
    rows.append(np.nonzero(m)[0]); cols.append(idx[ny[m], nx[m]]); vals.append(-w[m])
A = sparse.csr_matrix((np.concatenate([diag] + vals),
                       (np.concatenate([np.arange(len(ys))] + rows), np.concatenate([np.arange(len(ys))] + cols))),
                      shape=(len(ys), len(ys)))
print("unknowns", len(ys))
u = spsolve(A.tocsc(), np.ones(len(ys)))
h = np.zeros((N, N)); h[ys, xs] = u

# ---------- 6. linear extension outside ----------
gyh, gxh = np.gradient(h, DX)
g = np.hypot(gxh, gyh)
band = inside & (sd < 3 * DX) & (sd > 0.5 * DX)   # reliable edge slopes, just inside
_, (iy, ix) = ndimage.distance_transform_edt(~band, return_indices=True)
g_ext = ndimage.gaussian_filter(g[iy, ix], 2)
BAND = 4.0                                      # svg units of exact continuation outside
GM = float(g_ext[inside & (sd < 3 * DX)].max())
h_out = np.where(sd > -BAND, g_ext * sd, g_ext * -BAND + GM * (sd + BAND))   # far: slope = gmax → big safe steps
h = np.where(inside, h, h_out)
# near-edge inside texels: replace by slope·distance (exact zero contour, removes staircase)
near = inside & (sd < 1.0 * DX)
h[near] = (g_ext * sd)[near]
GMAX = float(g_ext[band].max())
HCLAMP = -GMAX * 40.0                           # ~40 svg units of empty-space skipping is plenty
h = np.maximum(h, HCLAMP)
print("h range", h.min(), h.max(), "gmax", GMAX)

# ---------- 7. pack: uint16, 2D (left+up-upleft) predictor, gzip ----------
lo, hi = float(h.min()), float(h.max())
q = np.round((h - lo) / (hi - lo) * 65535).astype(np.int64)
far = sd < -(BAND + 2)                          # far field only drives empty-space skipping → coarse
q[far] = (q[far] // 64) * 64
pred = np.zeros_like(q)
pred[1:, 1:] = q[1:, :-1] + q[:-1, 1:] - q[:-1, :-1]
pred[0, 1:] = q[0, :-1]; pred[1:, 0] = q[:-1, 0]
res = ((q - pred) & 0xFFFF).astype("<u2")
blob = gzip.compress(res.tobytes(), 9)
# ---------- 8. swell field G: local edge slope (≈ local stroke half-width), smooth, 256² ----------
# growing a stroke of half-width a by δ:  h' = h + a·δ + δ²/2   → kinetic weight / swell in the shader
GN = 256
G = ndimage.gaussian_filter(g_ext, 20)   # very smooth: any ripple in G shows up in the chrome
G = ndimage.zoom(G, GN / N, order=1)
gq = (np.round(np.clip(G / GMAX, 0, 1) * 4095) * 16).astype(np.int64)   # 12-bit + bicubic sampling is plenty for a smooth field
gp = np.zeros_like(gq); gp[1:, 1:] = gq[1:, :-1] + gq[:-1, 1:] - gq[:-1, :-1]; gp[0, 1:] = gq[0, :-1]; gp[1:, 0] = gq[:-1, 0]
gblob = gzip.compress(((gq - gp) & 0xFFFF).astype("<u2").tobytes(), 9)
print("G gzip KB", len(gblob) / 1024)
meta = dict(n=N, x0=X0, y0=Y0, span=SPAN, lo=lo, hi=hi, gmax=GMAX, data=base64.b64encode(blob).decode(),
            gn=GN, gdata=base64.b64encode(gblob).decode())
json.dump(meta, open(OUT, "w"))
print("gzip KB", len(blob) / 1024, "→ base64 KB", len(meta["data"]) / 1024)
import os; np.save(os.path.join(os.path.dirname(os.path.abspath(OUT)), "h.npy"), h)   # raw field next to the json (used by gmesh.py)
