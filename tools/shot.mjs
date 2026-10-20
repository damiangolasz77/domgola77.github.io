// Headless screenshots of the dev server (npm run dev must be running).
//   node tools/shot.mjs <path> <WxH> <out.png> [scroll 0..1] [settle seconds]
// e.g. node tools/shot.mjs /about/ 1512x945 snap-about.png 0 2
// CHROME=/path/to/chrome overrides the browser binary (Playwright's own is used otherwise).
import { chromium } from 'playwright';

const [path = '/', size = '1440x900', out = 'snap.png', scroll = '0', settle = '2'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto('http://localhost:5173' + path, { waitUntil: 'load' });
await page.waitForTimeout(1500);
if (path.startsWith('/about')) await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
const p = +scroll;
if (p > 0) {
  await page.evaluate(p => { const max = document.documentElement.scrollHeight - innerHeight; (window.__lenis ? __lenis.scrollTo(max * p, { immediate: true }) : scrollTo(0, max * p)); }, p);
}
await page.evaluate(s => window.__about?._advance?.(s), +settle);
await page.waitForTimeout(+settle * 1000);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
