'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const ext = path.join(root, 'extension');
const out = path.join(root, 'store', 'assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lnt-store-'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REPO_URL = process.env.REPO_URL || 'https://github.com/arcadie2k/localhost-new-tab';
const PAGES_URL = process.env.PAGES_URL || 'https://arcadie2k.github.io/localhost-new-tab';

fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(ext, 'fonts'), path.join(tmp, 'fonts'), { recursive: true });

const FONTS = `@font-face{font-family:Sans;font-weight:100 900;src:url(fonts/inter-latin-wght-normal.woff2)}
  @font-face{font-family:Mono;font-weight:100 800;src:url(fonts/jetbrains-mono-latin-wght-normal.woff2)}
  body{font-family:Sans,system-ui,sans-serif!important}`;

function shoot(htmlFile, file, width, height, scale = 1) {
  const url = htmlFile.includes('://') ? htmlFile : `file://${htmlFile}`;
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', `--force-device-scale-factor=${scale}`, `--user-data-dir=${path.join(tmp, 'profile')}`,
    `--window-size=${width},${height}`, '--virtual-time-budget=3000', '--default-background-color=00000000',
    `--screenshot=${file}`, url,
  ], { stdio: 'ignore', timeout: 60000 });
}

function page(name, body, css) {
  const file = path.join(tmp, `${name}.html`);
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased}${css}
  </style></head><body>${body}</body></html>`);
  return file;
}

/* Fake projects rendered as thumbnails */

const SITES = {
  northwind: page('northwind', `
    <nav><b>Northwind</b><span>Product</span><span>Pricing</span><span>Customers</span><a>Start free</a></nav>
    <header><h1>Invoices that<br>send themselves.</h1><p>Northwind turns time logs into paid invoices while you keep shipping.</p><a>Start free</a></header>
    <section><div class="bar"></div><div class="rows">${'<div class="row"><i></i><i></i><i></i></div>'.repeat(5)}</div></section>`, `
    body{background:#fbfaf7;color:#14130f;padding:28px 72px}
    nav{display:flex;gap:28px;align-items:center;font-size:15px;color:#555}nav b{color:#14130f;font-size:18px;margin-right:auto}nav a{background:#14130f;color:#fff;padding:9px 18px}
    header{text-align:center;padding:88px 0 48px}h1{font-size:76px;line-height:1;letter-spacing:-.04em;font-weight:600}p{font-size:20px;color:#666;margin:24px 0 32px}header a{background:#ff5a1f;color:#fff;padding:14px 26px;font-weight:500}
    section{margin:0 80px;border:1px solid #e6e2d9;background:#fff;height:400px;padding:20px}.bar{height:14px;width:30%;background:#ece8df}
    .rows{margin-top:24px}.row{display:flex;gap:20px;padding:14px 0;border-top:1px solid #f0ece4}.row i{height:12px;background:#ece8df;flex:1}.row i:first-child{flex:3}`),
  atlas: page('atlas', `
    <aside><b>Atlas</b>${['Overview', 'Revenue', 'Customers', 'Events', 'Settings'].map((x, i) => `<span${i === 0 ? ' class="on"' : ''}>${x}</span>`).join('')}</aside>
    <main><h2>Overview</h2><div class="kpis">${[['MRR', '$48,210'], ['Active users', '12,904'], ['Churn', '1.8%'], ['NPS', '62']].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <div class="chart">${[38, 52, 46, 61, 58, 72, 66, 80, 77, 92, 88, 97].map((h) => `<i style="height:${h}%"></i>`).join('')}</div></main>`, `
    body{display:flex;height:100vh;background:#0e1116;color:#e8ecf2}aside{width:220px;background:#151a21;padding:28px 20px;display:flex;flex-direction:column;gap:6px}
    aside b{font-size:19px;margin-bottom:24px}aside span{padding:9px 12px;color:#8b95a5;font-size:15px}aside .on{background:#222a35;color:#fff}
    main{flex:1;padding:36px 44px}h2{font-size:30px;font-weight:600;letter-spacing:-.02em}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}
    .kpis div{background:#151a21;padding:20px;border:1px solid #232b36}.kpis small{color:#8b95a5;font-size:13px}.kpis b{display:block;font-size:30px;margin-top:8px;font-weight:600}
    .chart{height:380px;background:#151a21;border:1px solid #232b36;display:flex;align-items:flex-end;gap:14px;padding:28px}.chart i{flex:1;background:linear-gradient(#5b8cff,#3a5bd9)}`),
  pebble: page('pebble', `
    <div class="phone"><h3>Today</h3><p>4 of 6 habits done</p>${[['Morning run', '#ffb547', 1], ['Read 20 pages', '#7bd389', 1], ['Stretch back', '#6fb7ff', 1], ['No sugar', '#ff7a8a', 1], ['Journal', '#c59bff', 0], ['Sleep by 23:30', '#5ad1c8', 0]].map(([t, c, d]) => `<div class="h"><i style="background:${c}"></i>${t}<em class="${d ? 'd' : ''}"></em></div>`).join('')}</div>`, `
    body{background:#f1efe9;display:grid;place-items:center;height:100vh}.phone{width:390px;height:700px;background:#fff;padding:44px 28px;box-shadow:0 30px 60px rgba(0,0,0,.08)}
    h3{font-size:40px;letter-spacing:-.03em}p{color:#888;margin:6px 0 26px;font-size:16px}.h{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid #f0f0f0;font-size:17px}
    .h i{width:34px;height:34px}.h em{margin-left:auto;width:24px;height:24px;border:2px solid #ddd}.h em.d{background:#111;border-color:#111}`),
  fieldnotes: page('fieldnotes', `
    <nav>Field Notes<span>Essays · Archive · About</span></nav><h1>Small tools,<br>long walks.</h1>
    ${['On building things nobody asked for', 'A year of writing every morning', 'The quiet joy of plain text', 'Notes from the Carpathians'].map((t, i) => `<article><small>0${i + 1} · Oct ${12 - i * 3}</small><h4>${t}</h4></article>`).join('')}`, `
    body{background:#fff;color:#1b1b1b;padding:40px 180px;font-family:Georgia,"Times New Roman",serif}nav{display:flex;justify-content:space-between;font-size:18px}nav span{color:#999;font-size:15px;font-family:-apple-system,system-ui}
    h1{font-size:84px;line-height:1;letter-spacing:-.03em;font-weight:400;margin:90px 0 60px}article{border-top:1px solid #e8e8e8;padding:20px 0}small{color:#999;font-family:-apple-system,system-ui;font-size:13px}h4{font-size:28px;font-weight:400;margin-top:6px}`),
  studio: page('studio', `
    <nav><b>M. Ionescu</b><span>Work</span><span>About</span><span>Contact</span></nav><h1>Designer &amp; developer<br>making calm software.</h1>
    <div class="grid"><i style="background:#d8e4ff"></i><i style="background:#ffe0cc"></i><i style="background:#d6f5e3"></i></div>`, `
    body{background:#0b0b0b;color:#f2f2f2;padding:32px 64px}nav{display:flex;gap:28px;font-size:15px;color:#888}nav b{color:#fff;margin-right:auto}
    h1{font-size:80px;line-height:1.02;letter-spacing:-.04em;font-weight:500;margin:110px 0 70px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid i{height:300px}`),
};

function thumb(name) {
  const png = path.join(tmp, `${name}.png`);
  const jpg = path.join(tmp, `${name}.jpg`);
  shoot(SITES[name], png, 1280, 800);
  execFileSync('/usr/bin/sips', ['-Z', '800', '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', png, '--out', jpg], { stdio: 'ignore' });
  return `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}`;
}

function favicon(letter, bg, fg = '#fff') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${bg}"/><text x="16" y="22.5" font-family="-apple-system,Helvetica" font-size="18" font-weight="700" text-anchor="middle" fill="${fg}">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/* New tab page with mock data */

const now = Date.now();
const H = 3600e3;
const D = 24 * H;
const P = (id, framework, dir, status, ports, lastSeen, extra = {}) => ({
  id, name: id, framework, root: `/Users/you/${dir}/${id}`, displayRoot: `~/${dir}/${id}`, status, ports, lastSeen,
  firstSeen: lastSeen - 20 * D, command: 'pnpm dev', customCommand: false, hasLog: true, kind: 'web', ...extra,
});
const live = (port, proc, kind = 'web') => ({ port, live: true, proc, kind, lastSeen: now });
const idle = (port, proc, ago, kind = 'web') => ({ port, live: false, proc, kind, lastSeen: now - ago });

const projects = [
  P('northwind-web', 'Next.js', 'code', 'running', [live(3000, 'next-server')], now),
  P('atlas-dashboard', 'Vite', 'code', 'running', [live(5173, 'vite'), live(6006, 'storybook')], now),
  P('pebble-habits', 'Expo', 'code', 'running', [live(8081, 'node', 'http')], now, { kind: 'mobile' }),
  P('field-notes', 'Astro', 'writing', 'running', [live(4321, 'astro')], now),
  P('studio-portfolio', 'Next.js', 'code', 'stopped', [idle(3000, 'next-server', D)], now - D),
  P('billing-api', 'Express', 'code', 'running', [live(8080, 'node', 'http'), live(9229, 'node', 'tcp')], now, { kind: 'service' }),
  P('ml-playground', 'Python', 'lab', 'stopped', [idle(8000, 'python3', 9 * D, 'http')], now - 9 * D, { command: null, kind: 'service' }),
];

console.log('rendering thumbnails…');
const media = {};
for (const [id, site, icon] of [
  ['northwind-web', 'northwind', favicon('N', '#ff5a1f')],
  ['atlas-dashboard', 'atlas', favicon('A', '#3a5bd9')],
  ['pebble-habits', 'pebble', favicon('P', '#7bd389', '#0b3d1e')],
  ['field-notes', 'fieldnotes', favicon('F', '#1b1b1b')],
  ['studio-portfolio', 'studio', favicon('M', '#f2f2f2', '#0b0b0b')],
]) {
  media[`thumb:${id}`] = { url: thumb(site), at: now };
  media[`icon:${id}`] = { url: icon, at: now };
}
media['icon:billing-api'] = { url: favicon('B', '#8b5cf6'), at: now };

const css = fs.readFileSync(path.join(ext, 'newtab.css'), 'utf8');
const html = fs.readFileSync(path.join(ext, 'newtab.html'), 'utf8');
const DEMO_ONLY = process.argv.includes('--demo-only');
const MODULE_TAG = '<script type="module" src="js/main.js"></script>';
const copyModules = (dir) => fs.cpSync(path.join(ext, 'js'), path.join(dir, 'js'), { recursive: true });

const DEMO_APPS = { editors: ['Visual Studio Code', 'Cursor', 'Zed'], terminals: ['Terminal', 'iTerm', 'Warp'] };

function newtab(name, scheme, after = '', apps = DEMO_APPS, extraMedia = {}) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(ext, 'fonts'), path.join(dir, 'fonts'), { recursive: true });
  const themed = css.replace('@media (prefers-color-scheme: dark)', scheme === 'dark' ? '@media all' : '@media not all');
  fs.writeFileSync(path.join(dir, 'newtab.css'), themed + '\n.toast{display:none}*,*::before,*::after{animation:none!important;transition:none!important}');
  copyModules(dir);
  fs.copyFileSync(path.join(ext, 'theme.js'), path.join(dir, 'theme.js'));
  fs.writeFileSync(path.join(dir, 'mock.js'), `
    const DATA = ${JSON.stringify({ projects, apps })};
    const MEDIA = ${JSON.stringify({ ...media, ...extraMedia })};
    document.startViewTransition = undefined;
    window.chrome = {
      runtime: { id: 'store', lastError: null, sendNativeMessage(_h, msg, cb) { setTimeout(() => cb(msg.type === 'scan' ? JSON.parse(JSON.stringify(DATA)) : { ok: true }), 0); } },
      storage: { local: { get(_k, cb) { cb(MEDIA); }, set: async () => {}, remove: async () => {} }, onChanged: { addListener() {} } },
    };`);
  fs.writeFileSync(path.join(dir, 'after.js'), `setTimeout(() => { ${after} }, 400);`);
  fs.writeFileSync(
    path.join(dir, 'newtab.html'),
    html.replace(MODULE_TAG, `<script src="mock.js"></script>${MODULE_TAG}<script type="module" src="after.js"></script>`)
  );
  return path.join(dir, 'newtab.html');
}

/* Interactive demo (also served by GitHub Pages) */

const demoDir = path.join(root, 'demo');
fs.rmSync(demoDir, { recursive: true, force: true });
fs.mkdirSync(path.join(demoDir, 'icons'), { recursive: true });
fs.cpSync(path.join(ext, 'fonts'), path.join(demoDir, 'fonts'), { recursive: true });
for (const size of [16, 32]) fs.copyFileSync(path.join(ext, 'icons', `icon${size}.png`), path.join(demoDir, 'icons', `icon${size}.png`));
fs.writeFileSync(path.join(demoDir, 'newtab.css'), css + '\n' + fs.readFileSync(path.join(__dirname, 'demo', 'demo.css'), 'utf8'));
copyModules(demoDir);
fs.copyFileSync(path.join(ext, 'theme.js'), path.join(demoDir, 'theme.js'));
fs.copyFileSync(path.join(__dirname, 'demo', 'mock.js'), path.join(demoDir, 'mock.js'));
fs.writeFileSync(path.join(demoDir, 'data.js'), `window.DEMO = ${JSON.stringify({
  builtAt: now,
  projects,
  media,
  apps: { editors: ['Visual Studio Code', 'Cursor', 'Zed'], terminals: ['Terminal', 'iTerm', 'Warp'] },
})};\n`);
fs.writeFileSync(path.join(demoDir, 'index.html'), html
  .replace('<title>New Tab</title>', `<title>Localhost New Tab demo</title>
  <meta name="description" content="Every localhost project you've run, one new tab away. Interactive demo with fictional projects.">
  <meta property="og:title" content="Localhost New Tab">
  <meta property="og:description" content="Every localhost project you've run, one new tab away.">
  <meta property="og:image" content="${PAGES_URL}/assets/social/og-1200x630.png">
  <meta name="twitter:card" content="summary_large_image">`)
  .replace('<body>', `<body>
  <p class="demo-banner">Interactive demo with fictional projects. The real extension reads your own localhost. <a href="${REPO_URL}">Get it on GitHub</a></p>`)
  .replace(MODULE_TAG, `<script src="data.js"></script>\n  <script src="mock.js"></script>\n  ${MODULE_TAG}`));

if (DEMO_ONLY) {
  console.log('demo rebuilt');
  process.exit(0);
}

console.log('rendering screenshots…');
shoot(newtab('s1', 'light'), path.join(out, 'screenshot-1-overview-light.png'), 1280, 800);
shoot(newtab('s2', 'dark'), path.join(out, 'screenshot-2-overview-dark.png'), 1280, 800);
shoot(
  newtab('s3', 'light', `
    setTimeout(() => {
      const btn = document.querySelector('.card[data-id="atlas-dashboard"] [data-action="ports"]');
      if (btn) openPorts(byId('atlas-dashboard'), btn);
      closeMenu = () => {};
    }, 200);`),
  path.join(out, 'screenshot-3-actions-light.png'),
  1280,
  800
);

/* LinkedIn carousel, 1920x1080 */

const carousel = path.join(root, 'assets', 'social', 'linkedin');
fs.mkdirSync(carousel, { recursive: true });
const card = (id, action) => `document.querySelector('.card[data-id="${id}"] [data-action="${action}"]')`;
const mark = fs.readFileSync(path.join(root, 'assets', 'icons', 'icon512.svg'), 'utf8');
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const slideCss = `${FONTS}
  body{width:1920px;height:1080px;background:#f1eee9;color:#111;display:flex;overflow:hidden}
  .copy{width:700px;padding:120px 0 0 112px;flex:none}.mark svg{width:72px;height:72px;display:block}
  h1{font-size:76px;line-height:1;letter-spacing:-2.3px;font-weight:300;margin-top:56px;text-wrap:balance}
  p{font-size:26px;line-height:1.45;letter-spacing:-.26px;color:#414141;margin-top:36px;max-width:520px;text-wrap:pretty}
  .shot{margin:120px 0 0 24px;border:1px solid #dedbd6;border-radius:6px;align-self:flex-start;flex:none;background-repeat:no-repeat}`;
const slide = (name, title, text, shot) => shoot(page(name, `
  <div class="copy"><div class="mark">${mark}</div><h1>${title}</h1><p>${text}</p></div>${shot}`, slideCss), path.join(carousel, `${name}.png`), 1920, 1080);
const TERMINALS = new Set(['Terminal', 'iTerm', 'Warp', 'Ghostty', 'Alacritty', 'kitty', 'WezTerm', 'Hyper']);
let localIcons = {};
try {
  localIcons = JSON.parse(execFileSync('node', [path.join(root, 'host', 'host.js'), '--cli', '{"type":"appIcons"}'], { encoding: 'utf8' })).icons || {};
} catch {}
const localNames = Object.keys(localIcons);
const localApps = localNames.length
  ? { editors: localNames.filter((n) => !TERMINALS.has(n)), terminals: localNames.filter((n) => TERMINALS.has(n)) }
  : DEMO_APPS;
const closeUp = (name, title, text, after, [x, y], zoom = 1.7) => {
  const file = path.join(tmp, `${name}-full.png`);
  shoot(newtab(name, 'dark', `setTimeout(() => { ${after} }, 1200);`, localApps, { appIcons: { icons: localIcons } }), file, 1280, 1000, 2);
  const w = 1196, h = 960;
  slide(name, title, text, `<div class="shot" style="width:${w + 40}px;height:${h + 40}px;background-color:#111112;background-image:url(${dataUrl(file)});background-size:${1280 * zoom}px auto;background-position:${w / 2 - x * zoom}px ${h / 2 - y * zoom}px"></div>`);
};

shoot(newtab('2-overview', 'light'), path.join(carousel, '2-overview.png'), 1280, 720, 1.5);
shoot(newtab('1-title', 'light'), path.join(tmp, '1-title-full.png'), 1280, 800, 1.5);
slide('1-title', 'Every project you run on localhost, on your new tab.',
  'Start and stop dev servers. Open any project in Finder, your editor or a terminal in one click.',
  `<img class="shot" src="${dataUrl(path.join(tmp, '1-title-full.png'))}" style="width:1600px" alt="">`);
closeUp('3-terminal', 'Open it in your terminal.', 'Pick any terminal you have installed, right from the card.', `
  const p = byId('field-notes'), btn = ${card('field-notes', 'menu')};
  openMenu(p, btn);
  openChooser(p, btn, 'terminal');
  closeMenu = () => {};`, [640, 570]);
closeUp('4-editor', 'Or in your code editor.', 'Every editor you have installed is one click away. The folder button opens it in Finder.', `
  const p = byId('atlas-dashboard'), btn = ${card('atlas-dashboard', 'editor')};
  openChooser(p, btn, 'editor');
  closeMenu = () => {};`, [360, 570]);

/* README hero + social images */

const docs = path.join(root, 'docs');
const social = path.join(root, 'assets', 'social');
fs.mkdirSync(docs, { recursive: true });
fs.mkdirSync(social, { recursive: true });
const demoUrl = `file://${path.join(demoDir, 'index.html')}`;
shoot(`${demoUrl}?shot&theme=light`, path.join(docs, 'hero-light.png'), 1280, 800, 2);
shoot(`${demoUrl}?shot&theme=dark`, path.join(docs, 'hero-dark.png'), 1280, 800, 2);
const heroLight = `data:image/png;base64,${fs.readFileSync(path.join(docs, 'hero-light.png')).toString('base64')}`;
const markSvg = fs.readFileSync(path.join(root, 'assets', 'icons', 'icon512.svg'), 'utf8');

const landscape = (name, w, h) => {
  shoot(page(name, `
    <div class="copy"><div class="mark">${markSvg}</div><h1>Your new tab knows what's running.</h1>
    <p>Every project you run on localhost, one tab away. Start, stop, open in your editor.</p></div>
    <img src="${heroLight}" alt="">`, `${FONTS}
    body{width:${w}px;height:${h}px;background:#f1eee9;color:#111;display:flex;overflow:hidden}
    .copy{width:${Math.round(w * 0.4)}px;padding:64px 0 0 64px;flex:none}.mark svg{width:56px;height:56px;display:block}
    h1{font-size:54px;line-height:1;letter-spacing:-1.62px;font-weight:300;margin-top:40px;text-wrap:balance}
    p{font-size:20px;line-height:1.4;letter-spacing:-.2px;color:#414141;margin-top:24px;max-width:400px;text-wrap:pretty}
    img{width:1100px;margin:64px 0 0 40px;border:1px solid #dedbd6;border-radius:4px;align-self:flex-start}`), path.join(social, `${name}.png`), w, h);
};
landscape('github-social-1280x640', 1280, 640);
landscape('og-1200x630', 1200, 630);

shoot(page('linkedin-1080x1350', `
  <div class="mark">${markSvg}</div>
  <h1>My new tab finally does something.</h1>
  <p>Every project I run on localhost, one tab away.</p>
  <img src="${heroLight}" alt="">`, `${FONTS}
  body{width:1080px;height:1350px;background:#f1eee9;color:#111;padding:96px 0 0 88px;overflow:hidden;position:relative}
  .mark svg{width:72px;height:72px;display:block}
  h1{font-size:80px;line-height:.95;letter-spacing:-2.4px;font-weight:300;margin-top:56px;max-width:860px;text-wrap:balance}
  p{font-size:28px;line-height:1.35;letter-spacing:-.3px;color:#414141;margin-top:32px}
  img{position:absolute;left:88px;top:560px;width:1240px;border:1px solid #dedbd6;border-radius:4px}`), path.join(social, 'linkedin-1080x1350.png'), 1080, 1350);

/* Promo tiles */

const iconSvg = fs.readFileSync(path.join(root, 'assets', 'icons', 'icon512.svg'), 'utf8');
const screenshotData = `data:image/png;base64,${fs.readFileSync(path.join(out, 'screenshot-1-overview-light.png')).toString('base64')}`;

const small = page('promo-small', `
  <div class="mark">${iconSvg}</div>
  <h1>Localhost<br>New Tab</h1>
  <p>Every dev server,<br>one tab away.</p>`, `${FONTS}
  body{width:440px;height:280px;background:#faf9f6;color:#111;padding:36px 36px;position:relative;overflow:hidden}
  .mark svg{width:56px;height:56px;display:block}h1{font-size:40px;line-height:1;letter-spacing:-1.2px;font-weight:300;margin-top:26px}
  p{position:absolute;right:36px;bottom:36px;text-align:right;font:400 12px/1.5 Mono,monospace;letter-spacing:1.2px;text-transform:uppercase;color:#585858}`);
shoot(small, path.join(out, 'promo-small-440x280.png'), 440, 280);

const marquee = page('promo-marquee', `
  <div class="copy"><div class="mark">${iconSvg}</div><h1>Every project you run<br>on localhost, on every<br>new tab.</h1>
  <p>Start, stop and open dev servers. See which ports are live. Jump to Finder, your editor or a terminal in one click.</p></div>
  <img src="${screenshotData}" alt="">`, `${FONTS}
  body{width:1400px;height:560px;background:#f1eee9;color:#111;display:flex;overflow:hidden}
  .copy{width:600px;padding:64px 0 0 72px;flex:none}.mark svg{width:48px;height:48px;display:block}
  h1{font-size:54px;line-height:1;letter-spacing:-1.62px;font-weight:300;margin-top:36px}p{font-size:16px;line-height:1.5;letter-spacing:-.16px;color:#414141;margin-top:24px;max-width:420px;text-wrap:pretty}
  img{width:1060px;margin:64px 0 0 20px;border:1px solid #dedbd6;border-radius:4px;align-self:flex-start}`);
shoot(marquee, path.join(out, 'promo-marquee-1400x560.png'), 1400, 560);

fs.copyFileSync(path.join(ext, 'icons', 'icon128.png'), path.join(out, 'store-icon-128.png'));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('store assets written to', path.relative(root, out));
