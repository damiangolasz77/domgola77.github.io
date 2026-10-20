// Renders every 3D prop to a transparent PNG (difference matting: black + white render → exact alpha).
//   node tools/export-png.mjs 3600     → png/*.png   (needs: npx playwright install chromium, python3 + Pillow + numpy)
import { build } from 'esbuild';
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const size = process.argv[2] || '2400';
fs.mkdirSync('png/raw', { recursive: true });
await build({ entryPoints: ['src/export.js'], bundle: true, format: 'iife', outfile: 'png/raw/export.js', loader: { '.json': 'json', '.svg': 'text' } });
fs.writeFileSync('png/raw/export.html', '<!doctype html><html><body style="margin:0"><script src="export.js"></script></body></html>');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
await p.goto('file://' + path.resolve(`png/raw/export.html`) + `?s=${size}`);
await p.waitForFunction(() => window.__done, null, { timeout: 900000, polling: 2000 });
for (const o of await p.evaluate(() => window.__out))
  for (const k of ['black', 'white']) fs.writeFileSync(`png/raw/${o.name}.${k}.png`, Buffer.from(o[k].split(',')[1], 'base64'));
await b.close();
execFileSync('python3', ['tools/matte.py', 'png/raw', 'png'], { stdio: 'inherit' });
