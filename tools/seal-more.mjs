// Seals the private /more/ content so the public site never contains it in readable form.
//   MORE_KEY=… npm run seal:more
// 1. reads private/more-content.js (STUDIOS — titles, drawer copy, tiles; LOGOS — the brand strip),
// 2. copies the media it uses from private/ into public/static/ — every file in its own random nested folder
//    under a random hex name (fresh on every run), stripped of any naming context; the paths exist only
//    inside the encrypted payload,
// 3. encrypts the content (AES-256-GCM, key = PBKDF2-SHA256 of the key phrase, 600k iterations, random
//    salt + iv) into src/more/sealed.json. Without the key phrase the page only has ciphertext.
// Run again after editing the content or changing the key.
import { writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { randomBytes, webcrypto } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const phrase = (process.env.MORE_KEY || '').trim().toLowerCase();
if (!phrase) { console.error('Set MORE_KEY to the key phrase: MORE_KEY=… npm run seal:more'); process.exit(1); }

const { STUDIOS, LOGOS = [] } = await import(pathToFileURL(resolve(root, 'private/more-content.js')).href + '?t=' + Date.now());

// media go to bland, scattered random paths: public/static/<2>/<2>/<16 hex>.<ext>
const outRoot = resolve(root, 'public/static');
rmSync(outRoot, { recursive: true, force: true });
rmSync(resolve(root, 'public/x'), { recursive: true, force: true });   // old layout

const names = new Map();
const hex = n => randomBytes(n).toString('hex');
const pub = (file, from = 'private/more-media') => {
  if (!names.has(file)) {
    const src = resolve(root, from, file);
    if (!existsSync(src)) throw new Error('missing media: ' + file);
    const rel = `static/${hex(1)}/${hex(1)}/${hex(8)}${file.slice(file.lastIndexOf('.'))}`;
    mkdirSync(dirname(resolve(root, 'public', rel)), { recursive: true });
    copyFileSync(src, resolve(root, 'public', rel));
    names.set(file, '/' + rel);
  }
  return names.get(file);
};
const studios = STUDIOS.map(g => ({ ...g, cases: g.cases.map(c => ({ ...c, tiles: c.tiles.map(t => ({
  ...t, ...(t.src && { src: pub(t.src) }), ...(t.poster && { poster: pub(t.poster) }) })) })) }));
const logos = LOGOS.map(([file, alt]) => ({ src: pub(file + '.svg', 'private/more-logos'), alt }));

const { subtle } = webcrypto;
const salt = randomBytes(16), iv = randomBytes(12);
const base = await subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']);
const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const data = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify({ studios, logos }))));
const b64 = u => Buffer.from(u).toString('base64');
writeFileSync(resolve(root, 'src/more/sealed.json'), JSON.stringify({ v: 1, iter: 600000, salt: b64(salt), iv: b64(iv), data: b64(data) }) + '\n');

const unused = readdirSync(resolve(root, 'private/more-media')).length + LOGOS.length - names.size;
console.log(`sealed ${studios.reduce((n, g) => n + g.cases.length, 0)} cases, ${names.size} media files → public/static/ (${unused} unused files left in private/)`);
