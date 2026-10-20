// Home content.
// Works: real case studies (Pele Mele 3rd and Forge 4th, from his files; the other four moved over from domgola.framer.website) (covers first, then the drawer's
// images and motion clips in their order there). Media live in public/cases/ (images → WebP ≤1400 px,
// clips → H.264 720 px + a poster frame). The three formats from the drawers: 4:5, 1:1 and 16:9.
// "6+ years" below is his real project list.
const R45 = 0.8, R11 = 1, R169 = 16 / 9, R34 = 807 / 1080, RF = 1920 / 1079, RP = 938 / 1168;
const img = (name, ratio) => ({ type: 'image', src: `/cases/${name}.webp`, ratio });
const vid = (name, ratio = R45) => ({ type: 'video', src: `/cases/${name}.mp4`, poster: `/cases/${name}-poster.webp`, ratio });

export const CASES = [
  { title: 'Familijne', sub: 'Branding For Jubileus', tags: 'Branding',
    // drawer content (src/drawer/) — copy from the Familijne drawer on domgola.framer.website
    details: {
      kind: 'Branding',
      lead: 'Celebrating 30 Years of Jutrzenka Familijne: Vintage-Inspired Packaging and a Campaign Honoring Brand’s Unique Heritage',
      roles: ['Brand design', 'Packaging design', 'Campaign'],
      meta: ['Sweets', '7 days', '2025'],
      sections: [{ title: 'About', items: [
        { h: 'Packaging', p: 'For the 30th anniversary of Jutrzenka Familijne wafers, we created a packaging design inspired by vintage aesthetics. The project recalls the brand’s origins, linking historical flavors with timeless emotions, evoking nostalgia while celebrating three decades of family tradition.' },
        { h: 'Campaign', p: 'Our concept expanded beyond packaging into a comprehensive campaign: social media visuals, in-store materials, and key visuals. Each element highlighted the theme “30 Years, 30 Stories,” honoring the brand’s journey and engaging consumers through emotional, heritage-driven storytelling.' },
      ] }],
      credits: ['Valeria Marchuk', 'Dominik Gola'],
    },
    tiles: [img('familijne-cover', R45), img('familijne-a', R169), img('familijne-b', R11), img('familijne-c', R11), img('familijne-d', R169),
      img('familijne-e', R11), img('familijne-f', R11), img('familijne-g', R169)] },
  { title: 'WTTR®', sub: 'Kitchen Fixtures', tags: 'Web Design',
    details: {   // copy from the WTTR drawer on domgola.framer.website
      kind: 'Web Design',
      lead: 'Innovative WTTR Kitchen Solutions: Striking Brand Identity and Immersive Landing Page with AI-Enhanced Motion Design',
      roles: ['Web design', '3D design', 'AI concept design'],
      meta: ['Kitchen & home appliances', '3 weeks', '2025'],
      sections: [{ title: 'About', items: [
        { h: 'Landing page', p: 'For WTTR, a modern kitchen equipment brand, we designed a landing page and bold visual identity. The project emphasized innovation and elegance, with a clean digital experience that highlights faucets, hoods, and appliances through captivating, interactive presentation.' },
        { h: '3D & motion', p: 'Beyond the landing page, we created advanced 3D animations and motion graphics powered by artificial intelligence. This approach delivered a stunning, futuristic effect, positioning WTTR as a leader in design excellence while offering customers a memorable digital journey.' },
      ] }],
      credits: ['Concept photos: Falmec'],
    },
    tiles: [img('wttr-cover', R45), vid('wttr-v1'), vid('wttr-v2'), img('wttr-a', R169), vid('wttr-v3'), vid('wttr-v4'), img('wttr-b', R169),
      vid('wttr-v5'), img('wttr-c', R45), img('wttr-d', R169), img('wttr-e', R45), vid('wttr-v6')] },
  // supplied as files (Desktop/Portfolio AI/pele, 1–10; cover = 1, the rest mixed on request): 16:9, 3:4 and 1:1
  { title: 'Pele Mele', sub: 'Craft Coffee & Roastery', tags: 'Branding',
    // mixed so formats alternate and look-alikes (cans, posters, packaging) aren't neighbours
    tiles: [img('pele-cover', R169), img('pele-c', R34), img('pele-a', R169), img('pele-e', R34), img('pele-i', R34),
      img('pele-d', R11), img('pele-g', R34), img('pele-b', R169), img('pele-f', R34), img('pele-h', R34)] },
  // supplied as files (Desktop/Portfolio AI/forge, 1–8; cover = 1, the rest mixed on request): ~16:9 and ~4:5
  { title: 'Forge', sub: 'Branding for AI startup', tags: 'Branding',
    // mixed: landscape / portrait alternate, the two posters and the card / lanyards kept apart
    tiles: [img('forge-cover', RF), img('forge-a', RP), img('forge-e', RF), img('forge-f', RP), img('forge-c', RF),
      img('forge-b', RP), img('forge-d', RF), img('forge-g', RP)] },
  { title: 'Echa Drewna', sub: 'Handmade Wooden Art', tags: 'Branding',
    details: {   // copy from the Echa Drewna drawer on domgola.framer.website
      kind: 'Branding',
      lead: 'Echa Drewna Branding: Handcrafted Identity Inspired by Forest Heritage and Unique Wooden Homes with Artistic, Natural Spirit.',
      roles: ['Logo design', 'Branding', '3D design'],
      meta: ['Handmade art', '2 weeks', '2024'],
      sections: [{ title: 'About', items: [
        { h: 'Identity', p: 'For Echa Drewna, a family brand creating handmade wooden houses, we designed branding rooted in authenticity and nature. Inspired by forest surroundings and tradition, the concept emphasizes craftsmanship, diversity of shapes, and the unique imperfections of artisanal work.' },
        { h: 'Applications', p: 'The project included logo design, packaging, stationery, and social media materials. Natural colors and textures reflected woodland inspirations, while the identity highlighted the product as the centerpiece, blending storytelling with a warm, conceptual visual style true to the brand.' },
      ] }],
      credits: ['Maria Magdalena Krawczyk', 'Dominik Gola'],
    },
    tiles: [img('echa-cover', R45), vid('echa-v1'), img('echa-a', R169), vid('echa-v2'), img('echa-b', R45), img('echa-c', R169),
      img('echa-d', R45), img('echa-e', R45), img('echa-f', R169)] },
  { title: 'Dla Wolności', sub: 'Foundation', tags: 'Branding',
    details: {   // copy from the Dla Wolności drawer on domgola.framer.website
      kind: 'Branding',
      lead: 'Universal Visual Language Promoting Inclusion and Acceptance',
      roles: ['Logo design', 'Branding', 'Strategy'],
      meta: ['Foundation', 'Sport', '2 weeks', '2024'],
      sections: [{ title: 'About', items: [
        { h: 'Identity', p: 'For Fundacja dla Wolności, an organization supporting social integration and equality, we developed a cohesive visual identity and communication system based on clarity and empathy. The project aimed to create a universal language that transcends cultural and linguistic barriers, promoting values such as openness, acceptance, and mutual respect.' },
        { h: 'Pictograms', p: 'The new identity uses pictograms and illustrations as tools of social inclusion - visual symbols that speak to everyone, regardless of language, origin, or background. This approach highlights diversity as strength, turning visual communication into a bridge that connects people and fosters understanding.' },
        { h: 'Storytelling', p: 'Beyond design, our concept focused on storytelling through imagery. By combining simple forms with meaningful symbols, we built a visual ecosystem that reflects the Foundation’s mission - to open doors, encourage dialogue, and inspire collective action toward a more inclusive world.' },
      ] }],
      credits: ['Zuzanna Ptak', 'Dominik Gola'],
    },
    tiles: [img('wolnosc-cover', R45), img('wolnosc-a', R169), img('wolnosc-b', R45), img('wolnosc-c', R45), img('wolnosc-d', R169),
      img('wolnosc-e', R45), img('wolnosc-f', R45), img('wolnosc-g', R169), img('wolnosc-h', R45), img('wolnosc-i', R45)] },
];

// Logos in "6+ years" (his files, 18 × 18 rounded squares). First match on the project name wins;
// everything else gets his generic "others" mark (blue square with an arrow).
const logo = {
  vw: new URL('./assets/logos/vw-group.svg', import.meta.url).href,
  carrefour: new URL('./assets/logos/carrefour.svg', import.meta.url).href,
  cannes: new URL('./assets/logos/cannes-young-creatives.svg', import.meta.url).href,
  kwadron: new URL('./assets/logos/kwadron.svg', import.meta.url).href,
  qarbon: new URL('./assets/logos/qarbon.svg', import.meta.url).href,
  cichy: new URL('./assets/logos/cichy-zasada.svg', import.meta.url).href,
  booksy: new URL('./assets/logos/booksy.svg', import.meta.url).href,
  inpost: new URL('./assets/logos/inpost.svg', import.meta.url).href,
  others: new URL('./assets/logos/others.svg', import.meta.url).href,
  twofas: new URL('./assets/logos/2fas.svg', import.meta.url).href,
  kanal: new URL('./assets/logos/kanal-zero.svg', import.meta.url).href,
  bizee: new URL('./assets/logos/bizee.svg', import.meta.url).href,
  aramco: new URL('./assets/logos/aramco.svg', import.meta.url).href,
  otomoto: new URL('./assets/logos/otomoto.svg', import.meta.url).href,
};
const LOGOS = [
  [/^Volkswagen/, logo.vw], [/^Carrefour/, logo.carrefour], [/^Cannes Young Creatives/, logo.cannes],
  [/^Kwadron/, logo.kwadron], [/^Qarbon/, logo.qarbon], [/^Cichy Zasada/, logo.cichy],
  [/^2FAS/, logo.twofas], [/Kanał Zero/, logo.kanal], [/^Bizee/, logo.bizee], [/^Saudi Aramco/, logo.aramco], [/^OTOMOTO/, logo.otomoto], [/^Booksy/, logo.booksy], [/^InPost/, logo.inpost],
];
export const logoFor = project => LOGOS.find(([re]) => re.test(project))?.[1] || logo.others;

// Links: a row with one opens it in a new tab (the whole row is the link).
const LINKS = [
  [/^Kwadron - Promotional Website/, 'https://kwadroncartridge.com/'],
  [/^Kwadron - Mobile App/, 'https://apps.apple.com/us/app/kwadron/id6737981339'],
  [/^Carrefour Polska - Mobile Applications/, 'https://flyingbisons.com/case-studies/carrefour'],
  [/^OTOMOTO/, 'https://www.otomoto.pl/news'],
  [/^Triverna/, 'https://triverna.pl/zero'],
  [/^Bizee/, 'https://riotters.com/case-studies/bizee'],
  [/^2FAS Pass/, 'https://apps.apple.com/pl/app/password-manager-2fas-pass/id6504464955'],
  [/^2FAS Auth/, 'https://apps.apple.com/pl/app/2fa-authenticator-2fas/id1217793794'],
];
export const linkFor = project => LINKS.find(([re]) => re.test(project))?.[1] || null;

// [year, [[brand, what we did]]] — Dominik's real list (Oct 2026), newest year first, his order within a year.
// No awards (he dropped them). Logos/links are looked up on "brand - what we did".
export const GROUPS = [
  { title: 'Personal', icon: new URL('./assets/personal-g.webp', import.meta.url).href, years: [   // icon = the favicon G (chrome G on blue)
    ['2025', [['2FAS Auth', 'Mobile App Revamp'], ['2FAS Pass', 'Mobile App Design'], ['Cannes Young Creatives', 'Rights to our design work acquired']]],
    ['2024', [['Grochowski Architektura (ARCHE)', 'Website / Digital Experience'], ['Cannes Young Creatives', 'Special Recognition Award'], ['Deepflare', 'Website for a biotech startup'],
      ['Bizee', 'US company formation platform · via Riotters']]],
    ['2023', [['Qarbon IT', 'Website for a software house'], ['Cichy Zasada Capital Group', 'Corporate Website'], ['Volkswagen / Škoda / SEAT / CUPRA / Audi', 'Promotional Landing Pages'],
      ['SEO Tracking', 'Google Business Profile tracking platform · via Carbon IT'], ['InPost', 'Wix Plugin · via Qarbon IT']]],
  ] },
  { title: 'With Flying Bisons', icon: new URL('./assets/flying-bisons.webp', import.meta.url).href, years: [   // icon = Flying Bisons logo
    ['2026', [['Carrefour Polska', 'Confidential Project · In Progress'], ['Triverna × Kanał Zero', 'Campaign Landing Page & Visual Direction']]],
    ['2025', [['Saudi Aramco', 'Confidential Digital Product Design'], ['Media Company', 'Confidential Project · In Progress'],
      ['OTOMOTO', 'News platform for the OTOMOTO editorial team'], ['Carrefour Polska', 'Mobile Applications'], ['Booksy', 'Internal Promotional Video']]],
    ['2024', [['Saudi Arabia Government Platform', 'Landing Page, Mobile App & Web App'], ['Kwadron', 'Mobile App'], ['Kwadron', 'Promotional Website']]],
  ] },
];
