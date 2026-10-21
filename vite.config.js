import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const pages = { home: 'index.html', about: 'about/index.html', drafts: 'drafts/index.html', logo: 'logo/index.html', more: 'more/index.html' };

// Every page has `<!-- @nav -->` where the shared nav (+ the page-transition curtain) goes. The pill of
// the current page gets aria-current, based on <body data-page="…">. The curtain's head script is inlined.
// Link previews (Open Graph / Twitter) for every page: title from the page's <title>, one share image.
const SITE = 'https://domgola.pl';
const SHARE = {
  home: ['/', 'Creative designer & developer from Warsaw — product design, branding, 3D and motion. Work @ Flying Bisons.'],
  about: ['/about/', 'Who I am, what I do and where I’ve worked — Dominik Gola, creative designer & developer.'],
  drafts: ['/drafts/', 'Drafts — posters, web concepts and visual explorations by Dominik Gola.'],
  more: ['/more/', 'More works — by invitation.'],
  logo: ['/logo/', 'Chrome G — logo variants.'],
};
const esc = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
function shareTags(html, page) {
  const [path, desc] = SHARE[page] || SHARE.home;
  const title = (/<title>([^<]*)<\/title>/.exec(html)?.[1] || 'Dominik Gola').replace(/&amp;/g, '&');
  return `<meta name="description" content="${esc(desc)}">\n` +
    `<meta property="og:type" content="website">\n<meta property="og:site_name" content="Dominik Gola">\n` +
    `<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n` +
    `<meta property="og:url" content="${SITE}${path}">\n<meta property="og:image" content="${SITE}/og.png">\n` +
    `<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n` +
    `<meta property="og:image:alt" content="Dominik Gola — Creative Designer &amp; Developer, chrome G logo">\n` +
    `<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${SITE}/og.png">\n`;
}

function sharedNav() {
  return {
    name: 'shared-nav',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const page = /<body[^>]*data-page="([^"]+)"/.exec(html)?.[1];
        let nav = readFileSync(resolve(root, 'src/nav/nav.html'), 'utf8');
        if (page) nav = nav.replace(`data-nav-id="${page}"`, `data-nav-id="${page}" aria-current="page"`);
        const head = shareTags(html, page) + `<script>${readFileSync(resolve(root, 'src/curtain-head.js'), 'utf8')}</script>\n` +
          // favicon: the chrome G on the site blue (public/, made from the live 3D look)
          `<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" type="image/png" href="/favicon.png">\n` +
          `<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<meta name="theme-color" content="#ffffff">\n` +
          `<script type="speculationrules">{"prefetch":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}</script>\n`;
        html = html.replace('<!-- @footer -->', () => readFileSync(resolve(root, 'src/footer/footer.html'), 'utf8'));
        return html.replace('<!-- @nav -->', nav + '\n<div class="curtain" aria-hidden="true"></div>').replace('</head>', head + '</head>');
      },
    },
    handleHotUpdate({ file, server }) {
      if (/src\/(nav\/nav\.html|footer\/footer\.html|curtain-head\.js)$/.test(file)) server.ws.send({ type: 'full-reload' });
    },
    // dev: /about → /about/ (otherwise the SPA fallback serves the home page there)
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/(about|drafts|logo|more)(\?.*)?$/.exec(req.url || '');
        if (m) { res.statusCode = 301; res.setHeader('Location', `/${m[1]}/${m[2] || ''}`); return res.end(); }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [sharedNav()],
  server: { port: 5173 },
  build: {
    rollupOptions: { input: Object.fromEntries(Object.entries(pages).map(([k, p]) => [k, resolve(root, p)])) },
  },
});
