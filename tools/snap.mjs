// Headless snapshots of the About page at given scroll positions (deterministic physics stepping).
//   npx playwright install chromium   (once)
//   node tools/snap.mjs dist/about-drop.html 1440x900 0:2 0.5:1 1:3 0:3
// Each step is  progress:seconds  → scrolls to progress (0–1), advances the simulation, saves snap-N.png.
import { chromium } from 'playwright';
import path from 'path';

const [page, size = '1440x900', ...steps] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: w, height: h } });
pg.on('pageerror', e => console.log('page error:', e.message));
await pg.goto('file://' + path.resolve(page));
await pg.waitForFunction(() => window.__ready, null, { timeout: 240000 });
let i = 0;
for (const s of steps) {
  const [p, secs] = s.split(':').map(Number);
  await pg.evaluate(p => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * p), p);
  await pg.evaluate(t => window.__about._advance(t), secs);
  console.log(s, JSON.stringify(await pg.evaluate(() => window.__about._hero())));   // a = anchored (1 = in its slot), dx/dy = offset from slot
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `snap-${i++}.png` });
}
await b.close();
