# Difference matting: alpha = 1 - (white - black), colour = black / alpha; crop to content + padding.
import sys, glob, os, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for fb in sorted(glob.glob(f'{src}/*.black.png')):
    name = os.path.basename(fb)[:-len('.black.png')]
    B = np.asarray(Image.open(fb).convert('RGB'), np.float32) / 255
    W = np.asarray(Image.open(fb.replace('.black.', '.white.')).convert('RGB'), np.float32) / 255
    a = np.clip(1 - (W - B).mean(-1), 0, 1)
    a[a < 2 / 255] = 0
    c = np.where(a[..., None] > 1e-4, B / np.maximum(a[..., None], 1e-4), 0)
    c = np.clip(c, 0, 1)
    rgba = np.dstack([c, a])
    ys, xs = np.nonzero(a > 0.01)
    pad = int(0.035 * max(np.ptp(ys), np.ptp(xs)))
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, a.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, a.shape[1])
    im = Image.fromarray((rgba[y0:y1, x0:x1] * 255 + 0.5).astype(np.uint8), 'RGBA')
    im.save(f'{dst}/{name}.png', optimize=True)
    print(name, im.size)
