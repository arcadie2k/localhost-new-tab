'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

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
  agent: page('agent', `
    <aside><b><i></i>Relay</b><small>Agents</small>${[['Support triage', 1], ['Release notes writer', 0], ['Repo onboarding', 0], ['Invoice extractor', 0]].map(([t, on]) => `<span class="${on ? 'on' : ''}">${t}</span>`).join('')}<small>Tools</small>${['search_docs', 'create_ticket', 'run_sql'].map((t) => `<code>${t}</code>`).join('')}</aside>
    <main><header><h2>Support triage</h2><em>claude-sonnet · temp 0.2</em></header>
      <div class="msg user">Customer says exports fail since yesterday. Find the cause and open a ticket.</div>
      <div class="tool"><b>search_docs</b><span>"export failed" · 4 results · 182 ms</span></div>
      <div class="tool"><b>run_sql</b><span>SELECT status, count(*) FROM exports … · 38 ms</span></div>
      <div class="msg bot">Exports fail for files over 50 MB since the 2.14 deploy: the new upload limit is applied to exports too. I opened <u>SUP-482</u> with the query and a repro.</div>
      <div class="input">Ask the agent…<i></i></div></main>
    <section><h3>Run trace</h3>${[['Plan', '0.4s'], ['search_docs', '0.2s'], ['run_sql', '0.1s'], ['create_ticket', '0.3s'], ['Answer', '1.1s']].map(([t, d], k) => `<div><i style="width:${[20, 12, 8, 16, 48][k]}%"></i><span>${t}</span><em>${d}</em></div>`).join('')}<dl><dt>Tokens</dt><dd>3,412</dd><dt>Cost</dt><dd>$0.011</dd></dl></section>`, `
    body{display:flex;height:100vh;background:#0c0d10;color:#e9eaee;font-size:15px}
    aside{width:230px;background:#121318;border-right:1px solid #1f2128;padding:26px 16px;display:flex;flex-direction:column;gap:4px}
    aside b{display:flex;align-items:center;gap:10px;font-size:19px;margin-bottom:18px}aside b i{width:22px;height:22px;border-radius:7px;background:conic-gradient(from 200deg,#7c5cff,#20c4ff,#7c5cff)}
    aside small{color:#6b6f7c;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:16px 8px 6px}aside span{padding:9px 10px;border-radius:8px;color:#a3a7b3}aside .on{background:#1d1f27;color:#fff}
    aside code{font:13px Menlo,monospace;color:#9aa0ff;padding:6px 10px}
    main{flex:1;padding:28px 36px;display:flex;flex-direction:column;gap:14px}header{display:flex;align-items:baseline;gap:14px;margin-bottom:8px}h2{font-size:24px;font-weight:600}header em{font-style:normal;color:#6b6f7c;font-size:13px}
    .msg{padding:14px 18px;border-radius:14px;line-height:1.5;max-width:78%}.user{align-self:flex-end;background:#2a2d3a}.bot{background:#15171d;border:1px solid #23262f}.bot u{color:#9aa0ff;text-decoration:none}
    .tool{display:flex;gap:12px;align-items:center;font:13px Menlo,monospace;color:#8b90a0;padding:10px 14px;border:1px dashed #2a2d38;border-radius:10px;max-width:78%}.tool b{color:#7ee0b8;font-weight:500}
    .input{margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border:1px solid #262933;border-radius:14px;color:#5f6370}.input i{width:30px;height:30px;border-radius:9px;background:#7c5cff}
    section{width:300px;border-left:1px solid #1f2128;padding:28px 22px}h3{font-size:15px;color:#a3a7b3;font-weight:500;margin-bottom:18px}
    section div{position:relative;display:flex;justify-content:space-between;padding:10px 0;font-size:14px}section div i{position:absolute;left:0;bottom:2px;height:3px;border-radius:2px;background:#7c5cff}section em{font-style:normal;color:#6b6f7c}
    dl{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:26px;padding-top:18px;border-top:1px solid #1f2128;font-size:14px}dt{color:#6b6f7c}`),
  evals: page('evals', `
    <nav><b>Evals</b><span class="on">Overview</span><span>Datasets</span><span>Runs</span><span>Prompts</span><a>New run</a></nav>
    <div class="kpis">${[['Pass rate', '87.4%', '+2.1'], ['p50 latency', '412 ms', '-38'], ['Cost / 1k runs', '$0.18', '-0.04'], ['Regressions', '3', '']].map(([k, v, d]) => `<div><small>${k}</small><b>${v}</b><em>${d}</em></div>`).join('')}</div>
    <div class="row"><div class="chart"><h4>Pass rate by prompt version</h4><svg viewBox="0 0 600 220" preserveAspectRatio="none"><polyline points="0,170 60,160 120,150 180,155 240,120 300,118 360,96 420,90 480,70 540,64 600,52" fill="none" stroke="#2563eb" stroke-width="3"/><polyline points="0,190 60,185 120,180 180,176 240,170 300,160 360,158 420,150 480,146 540,140 600,136" fill="none" stroke="#a5b4fc" stroke-width="3"/></svg></div>
    <table><tr><th>Model</th><th>Score</th></tr>${[['sonnet', 92], ['llama-3.1-8b', 81], ['qwen2.5-7b', 78], ['mistral-7b', 71]].map(([m, v]) => `<tr><td>${m}</td><td><i style="width:${v}%"></i>${v}</td></tr>`).join('')}</table></div>`, `
    body{background:#f7f7f9;color:#111827;padding:26px 40px;font-size:15px}
    nav{display:flex;gap:24px;align-items:center;color:#6b7280}nav b{color:#111827;font-size:20px;margin-right:18px}nav .on{color:#111827;font-weight:600}nav a{margin-left:auto;background:#111827;color:#fff;padding:9px 16px;border-radius:8px}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}.kpis div{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
    .kpis small{color:#6b7280;font-size:13px}.kpis b{display:block;font-size:32px;font-weight:600;letter-spacing:-.02em;margin-top:8px}.kpis em{font-style:normal;color:#059669;font-size:13px}
    .row{display:grid;grid-template-columns:1.6fr 1fr;gap:16px}.chart,table{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:22px}h4{font-size:15px;font-weight:600;margin-bottom:18px}svg{width:100%;height:330px}
    table{border-collapse:separate;width:100%}th{text-align:left;color:#6b7280;font-weight:500;font-size:13px;padding-bottom:12px}td{padding:14px 0;border-top:1px solid #f1f2f4;font-size:15px}td:last-child{width:55%}td i{display:inline-block;height:8px;border-radius:4px;background:#2563eb;margin-right:10px;max-width:70%}`),
  docs: page('docs', `
    <nav><b>Relay Docs</b><span>Guides</span><span>API</span><span>Changelog</span><em>Search docs ⌘K</em></nav>
    <div class="wrap"><aside>${['Introduction', 'Quickstart', 'Agents', 'Tools', 'Tracing', 'Evals', 'Deploy'].map((t, i) => `<span class="${i === 1 ? 'on' : ''}">${t}</span>`).join('')}</aside>
    <main><small>Getting started</small><h1>Quickstart</h1><p>Create an agent, give it a tool and run it locally in under five minutes.</p>
    <pre><span>$</span> npx relay init support-bot
<span>$</span> relay dev --port 3000</pre><h3>Add your first tool</h3><p>Tools are typed functions the agent can call. Relay validates inputs and records every call in the trace.</p></main></div>`, `
    body{background:#fff;color:#0f172a;font-size:16px}nav{display:flex;gap:26px;align-items:center;padding:22px 48px;border-bottom:1px solid #eef0f3;color:#64748b}nav b{color:#0f172a;font-size:18px;margin-right:16px}
    nav em{margin-left:auto;font-style:normal;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;font-size:14px;color:#94a3b8;width:240px}
    .wrap{display:flex}aside{width:250px;padding:30px 24px 0 48px;display:flex;flex-direction:column;gap:4px}aside span{padding:8px 12px;border-radius:8px;color:#475569}aside .on{background:#eef2ff;color:#4338ca;font-weight:500}
    main{padding:40px 60px;max-width:760px}small{color:#6366f1;font-weight:600;font-size:14px}h1{font-size:46px;letter-spacing:-.03em;margin:8px 0 14px}p{color:#475569;line-height:1.6;font-size:18px}
    pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:22px 24px;margin:28px 0;font:15px/1.8 Menlo,monospace}pre span{color:#64748b}h3{font-size:22px;margin-bottom:10px}`),
  landing: page('landing', `
    <nav><b><i></i>Relay</b><span>Product</span><span>Docs</span><span>Pricing</span><a>Get started</a></nav>
    <header><em>New · Evals in the trace view</em><h1>Ship AI agents<br>you can actually trust.</h1><p>Build, trace and evaluate agents on your laptop. Deploy when the numbers say so.</p><a>Start building</a></header>
    <div class="logos">${['NORTHWIND', 'acme', 'Lumen', 'orbit', 'Vela'].map((l) => `<span>${l}</span>`).join('')}</div>`, `
    body{background:radial-gradient(1200px 600px at 50% -10%,#efe9ff,#fff 60%);color:#0d0b16;padding:28px 72px;height:100vh}
    nav{display:flex;gap:28px;align-items:center;font-size:15px;color:#5d5873}nav b{display:flex;gap:10px;align-items:center;color:#0d0b16;font-size:19px;margin-right:auto}nav b i{width:22px;height:22px;border-radius:7px;background:conic-gradient(from 200deg,#7c5cff,#20c4ff,#7c5cff)}nav a{background:#0d0b16;color:#fff;padding:9px 18px;border-radius:999px}
    header{text-align:center;padding:90px 0 56px}header em{font-style:normal;font-size:14px;color:#6d4dff;background:#fff;border:1px solid #e4dcff;padding:7px 14px;border-radius:999px}
    h1{font-size:78px;line-height:1.02;letter-spacing:-.045em;font-weight:600;margin:28px 0 22px}p{font-size:20px;color:#5d5873;margin-bottom:34px}header a{background:#6d4dff;color:#fff;padding:15px 28px;border-radius:999px;font-weight:500}
    .logos{display:flex;justify-content:center;gap:70px;color:#b3aec6;font-size:24px;font-weight:600;letter-spacing:.02em}`),
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
  P('agent-studio', 'Next.js', 'code', 'running', [live(3000, 'next-server')], now),
  P('eval-dashboard', 'Vite', 'code', 'running', [live(5173, 'vite'), live(6006, 'storybook')], now),
  P('voice-companion', 'Expo', 'code', 'running', [live(8081, 'node', 'http')], now, { kind: 'mobile' }),
  P('docs-site', 'Astro', 'code', 'running', [live(4321, 'astro')], now),
  P('rag-api', 'Python', 'code', 'running', [live(8000, 'uvicorn', 'http')], now, { kind: 'service', command: 'uv run fastapi dev' }),
  P('model-gateway', 'Python', 'models', 'running', [live(8080, 'python3', 'http'), live(9090, 'python3', 'tcp')], now, { kind: 'service', command: 'uv run serve.py' }),
  P('landing-v2', 'Next.js', 'code', 'stopped', [idle(3001, 'next-server', D)], now - D),
  P('vector-indexer', 'Go', 'code', 'stopped', [idle(7700, 'indexer', 3 * D, 'http')], now - 3 * D, { kind: 'service', command: 'go run ./cmd/indexer' }),
  P('fine-tune-lab', 'Python', 'lab', 'stopped', [idle(8888, 'jupyter-lab', 9 * D, 'http')], now - 9 * D, { kind: 'service', command: null }),
];

console.log('rendering thumbnails…');
const media = {};
for (const [id, site, icon] of [
  ['agent-studio', 'agent', favicon('R', '#7c5cff')],
  ['eval-dashboard', 'evals', favicon('E', '#2563eb')],
  ['docs-site', 'docs', favicon('D', '#4338ca')],
  ['landing-v2', 'landing', favicon('R', '#0d0b16')],
]) {
  media[`thumb:${id}`] = { url: thumb(site), at: now };
  media[`icon:${id}`] = { url: icon, at: now };
}
media['icon:voice-companion'] = { url: favicon('V', '#a77bff', '#1a0f3d'), at: now };

const css = fs.readFileSync(path.join(ext, 'newtab.css'), 'utf8');
const html = fs.readFileSync(path.join(ext, 'newtab.html'), 'utf8');
const DEMO_ONLY = process.argv.includes('--demo-only');
const MODULE_TAG = '<script type="module" src="js/main.js"></script>';
const copyModules = (dir) => fs.cpSync(path.join(ext, 'js'), path.join(dir, 'js'), { recursive: true });

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

const VERSION = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8')).version;
const port = Number(process.env.SHOT_PORT || 4199);
const server = spawn(process.execPath, ['-e', `
  const http = require('http'), fs = require('fs'), path = require('path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  http.createServer((req, res) => {
    const file = path.join(${JSON.stringify(demoDir)}, decodeURIComponent(req.url.split('?')[0]).replace(/\\/$/, '/index.html'));
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(${port}, '127.0.0.1');
`], { stdio: 'ignore' });
execFileSync('/bin/sh', ['-c', `for i in $(seq 1 50); do curl -sf -o /dev/null http://127.0.0.1:${port}/ && exit 0; sleep 0.1; done; exit 1`]);
const demoAt = (query) => `http://127.0.0.1:${port}/?shot&granted&${query}`;
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const markSvg = fs.readFileSync(path.join(root, 'assets', 'icons', 'icon512.svg'), 'utf8');

console.log('rendering screenshots…');
shoot(demoAt('theme=dark'), path.join(out, 'screenshot-1-overview-dark.png'), 1280, 800);
shoot(demoAt('theme=dark&tab=bookmarks&open=AI stack/Docs'), path.join(out, 'screenshot-2-bookmarks-dark.png'), 1280, 800);
shoot(demoAt('theme=light'), path.join(out, 'screenshot-3-overview-light.png'), 1280, 800);
shoot(demoAt('theme=light&menu=eval-dashboard:ports'), path.join(out, 'screenshot-4-ports-light.png'), 1280, 800);
for (const old of ['screenshot-1-overview-light.png', 'screenshot-2-overview-dark.png', 'screenshot-3-actions-light.png']) fs.rmSync(path.join(out, old), { force: true });

/* README hero + social images */

const docsDir = path.join(root, 'docs');
const social = path.join(root, 'assets', 'social');
fs.mkdirSync(social, { recursive: true });
shoot(demoAt('theme=light'), path.join(docsDir, 'hero-light.png'), 1280, 800, 2);
shoot(demoAt('theme=dark'), path.join(docsDir, 'hero-dark.png'), 1280, 800, 2);
const heroLight = dataUrl(path.join(docsDir, 'hero-light.png'));
const heroDark = dataUrl(path.join(docsDir, 'hero-dark.png'));

const landscape = (name, w, h) => shoot(page(name, `
  <div class="copy"><div class="mark">${markSvg}</div><h1>Your new tab knows what's running.</h1>
  <p>Every project you run on localhost, plus your most visited sites and bookmarks, one tab away.</p></div>
  <img src="${heroLight}" alt="">`, `${FONTS}
  body{width:${w}px;height:${h}px;background:#f1eee9;color:#111;display:flex;overflow:hidden}
  .copy{width:${Math.round(w * 0.4)}px;padding:64px 0 0 64px;flex:none}.mark svg{width:56px;height:56px;display:block}
  h1{font-size:54px;line-height:1;letter-spacing:-1.62px;font-weight:300;margin-top:40px;text-wrap:balance}
  p{font-size:20px;line-height:1.4;letter-spacing:-.2px;color:#414141;margin-top:24px;max-width:400px;text-wrap:pretty}
  img{width:1100px;margin:64px 0 0 40px;border:1px solid #dedbd6;border-radius:8px;align-self:flex-start}`), path.join(social, `${name}.png`), w, h);
landscape('github-social-1280x640', 1280, 640);
landscape('og-1200x630', 1200, 630);

/* LinkedIn update collage, 1080x1350 */

console.log('rendering LinkedIn collage…');
const parts = path.join(tmp, 'parts');
fs.mkdirSync(parts, { recursive: true });
const part = (name, query, w, h) => {
  const file = path.join(parts, `${name}.png`);
  shoot(demoAt(query), file, w, h, 2);
  return { file, w };
};
const overview = part('overview', 'theme=dark&expand', 1280, 820);
const bookmarks = part('bookmarks', 'theme=dark&tab=bookmarks&open=AI stack&hide=sites', 700, 560);
const settings = part('settings', 'theme=dark&settings', 904, 640);
const crop = ({ file, w }, cw, ch, x, y, zoom = 1) =>
  `<div class="shot" style="width:${cw}px;height:${ch}px;background-image:url(${dataUrl(file)});background-size:${w * zoom}px auto;background-position:${-x * zoom}px ${-y * zoom}px"></div>`;
const postDir = path.join(root, 'linkedin-post');
fs.mkdirSync(postDir, { recursive: true });
shoot(page('linkedin-update', `
  <header><div class="brand">${markSvg}<b>Localhost New Tab</b></div><span class="ver">v${VERSION}</span></header>
  <h1>Now with <em>Bookmarks</em> and <em>Most Visited</em></h1>
  <div class="grid">
    ${crop(overview, 904, 540, 0, 20, 904 / 1280)}
    <div class="row">${crop(bookmarks, 584, 431, 0, 20, 584 / 700)}${crop(settings, 300, 431, 572, 111)}</div>
  </div>`, `${FONTS}
  body{width:1080px;height:1350px;background:radial-gradient(900px 600px at 85% 0%,#e6ddff,transparent 70%),#f1eee9;color:#111;padding:72px 88px;overflow:hidden}
  header{display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:18px}.brand svg{width:56px;height:56px;display:block}
  .brand b{font-size:30px;font-weight:500;letter-spacing:-.6px}
  .ver{font:500 22px/1 Mono,monospace;letter-spacing:.5px;background:#111;color:#fff;padding:12px 18px;border-radius:999px}
  h1{font-size:50px;line-height:1.1;letter-spacing:-1.5px;font-weight:300;margin:52px 0 48px;white-space:nowrap}
  h1 em{font-style:italic;font-weight:600;letter-spacing:-1.2px}
  .grid{display:flex;flex-direction:column;gap:20px}.row{display:flex;gap:20px}
  .shot{border-radius:14px;background-color:#000;background-repeat:no-repeat;box-shadow:0 24px 48px rgba(30,20,60,.16),0 0 0 1px rgba(0,0,0,.06)}`),
  path.join(postDir, `update-v${VERSION}-1080x1350.png`), 1080, 1350);

/* Promo tiles */

console.log('rendering promo tiles…');
const tile = path.join(tmp, 'tile.png');
shoot(demoAt('theme=dark'), tile, 924, 588, 2);
shoot(page('promo-small', `<img src="${dataUrl(tile)}" alt="">`, `body{width:440px;height:280px;overflow:hidden;background:#000}img{width:440px;display:block}`),
  path.join(out, 'promo-small-440x280.png'), 440, 280);
shoot(page('promo-marquee', `
  <div class="copy"><div class="mark">${markSvg}</div><h1>Every project you run on localhost, on every new tab.</h1>
  <p>Start, stop and open dev servers. Your most visited sites and bookmarks sit right above them.</p></div>
  <img src="${heroDark}" alt="">`, `${FONTS}
  body{width:1400px;height:560px;background:#f1eee9;color:#111;display:flex;overflow:hidden}
  .copy{width:600px;padding:64px 0 0 72px;flex:none}.mark svg{width:48px;height:48px;display:block}
  h1{font-size:54px;line-height:1;letter-spacing:-1.62px;font-weight:300;margin-top:36px;text-wrap:balance}p{font-size:16px;line-height:1.5;color:#414141;margin-top:24px;max-width:420px;text-wrap:pretty}
  img{width:1060px;margin:64px 0 0 20px;border-radius:10px;align-self:flex-start}`),
  path.join(out, 'promo-marquee-1400x560.png'), 1400, 560);

fs.copyFileSync(path.join(ext, 'icons', 'icon128.png'), path.join(out, 'store-icon-128.png'));
server.kill();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('store assets written to', path.relative(root, out));
