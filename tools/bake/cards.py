# Cut-out cards: crop to alpha bbox, encode webp, convex-hull collider (normalised to width 1)
from PIL import Image; import numpy as np, json, base64, io, sys
from scipy.spatial import ConvexHull
# Run from the repo root: python3 bake/cards.py  → assets/cards.json
D = 'bake/cutouts-src/'
SRC = {'sneaker': D + 'sneaker.png', 'f1': D + 'f1.png', 'coffee': D + 'coffee.png', 'plant': D + 'plant.png', 'lamp': D + 'lamp.png'}
cr = lambda u, v: u[0] * v[1] - u[1] * v[0]
def simplify(poly, n):
    poly = list(poly)
    while len(poly) > n:
        best = None
        for i in range(len(poly)):
            p0, p1, p2 = np.array(poly[i - 1]), np.array(poly[i]), np.array(poly[(i + 1) % len(poly)])
            a = abs(cr(p1 - p0, p2 - p0)) / 2
            if best is None or a < best[0]: best = (a, i)
        poly.pop(best[1])
    return np.array(poly)
out = {}
for k, path in SRC.items():
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[..., 3]
    im = im.crop(Image.fromarray(((a > 20) * 255).astype(np.uint8)).getbbox())
    MAXW = 900; MAXH = 1000
    if im.height > MAXH: im = im.resize((round(im.width * MAXH / im.height), MAXH), Image.LANCZOS)
    if im.width > MAXW: im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    pad = 6; c = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad)); c.paste(im, (pad, pad)); im = c
    a = np.array(im)[..., 3]; W, H = im.size
    BANDS = {'lamp': [(0, .36), (.33, .9), (.87, 1)], 'plant': [(0, .52), (.48, 1)]}.get(k, [(0, 1)])
    hulls = []
    for b0, b1 in BANDS:                     # one convex piece per band → compound collider
        sub = a[int(b0 * H):int(np.ceil(b1 * H))]
        ys, xs = np.nonzero(sub > 128); ys = ys + int(b0 * H)
        pts = np.stack([xs, ys], 1)
        hp = simplify(pts[ConvexHull(pts).vertices].astype(float), 14 if len(BANDS) == 1 else 10)
        hulls.append([[round(x / W - .5, 4), round(-(y / H - .5) * H / W, 4)] for x, y in hp])
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=88, method=6)
    out[k] = {'w': W, 'h': H, 'hulls': hulls,
              'uri': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()}
    print(k, W, H, len(buf.getvalue()) // 1024, 'KB')
json.dump(out, open('assets/cards.json', 'w'))
