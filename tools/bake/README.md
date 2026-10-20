# Bake pipeline (run from repo root)

1. Logo field: `python3 bake/bake_field.py chrome-logo/logo.svg 1024 2.2 bake/logo-field/field.json`
   (also writes bake/logo-field/h.npy; copy field.json to chrome-logo/field.json for the web component)
2. Logo mesh + colliders: `python3 bake/gmesh.py 0.9 36000` → assets/gmesh.json
3. Cursor: `python3 bake/bake_field.py bake/cursor.svg 512 12 bake/cursor-field/field.json`
   then `GSRC=bake/cursor-field GOUT=assets/cursormesh.json GK2=0.6 python3 bake/gmesh.py 1.2 9000`
4. Cut-outs: put RGBA PNGs in bake/cutouts-src/, list them in cards.py, `python3 bake/cards.py` → assets/cards.json

Deps: numpy scipy scikit-image Pillow fast-simplification (+ fonttools brotli for font subsetting)
