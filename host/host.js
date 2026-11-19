#!/usr/bin/env node
'use strict';

const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const HOME = os.homedir();
const DATA_DIR = path.join(HOME, '.localhost-new-tab');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LOG_DIR = path.join(DATA_DIR, 'logs');

const MARKERS = [
  'package.json', 'deno.json', 'pyproject.toml', 'requirements.txt', 'manage.py',
  'Cargo.toml', 'go.mod', 'Gemfile', 'composer.json', 'mix.exs', '.git',
];
const GENERIC_NAMES = new Set(['web', 'app', 'apps', 'frontend', 'client', 'server', 'api', 'backend', 'site', 'www', 'ui', 'docs', 'dashboard', 'admin']);
const RUNNERS = new Set([
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'bunx', 'deno', 'tsx', 'ts-node', 'nodemon',
  'turbo', 'concurrently', 'next', 'vite', 'expo', 'astro', 'nuxt', 'remix', 'uvicorn',
  'gunicorn', 'flask', 'rails', 'ruby', 'php', 'go', 'cargo', 'python', 'python3',
]);
const NEVER_KILL = /claude|Visual Studio Code|Cursor|Electron|Antigravity|Code Helper|Warp|iTerm|Terminal\.app|Ghostty/i;
const EXCLUDED_TOP = new Set(['Library', 'Applications', '.Trash']);
const TOOLING = /(^|\/)(adb|qemu-system[\w-]*|netsimd|emulator[\w-]*|watchman|crashpad_handler)(\s|$)|GradleDaemon|gradle-daemon|KotlinCompileDaemon|kotlin-daemon|sourcekit-lsp|tsserver|language[-_]server/i;
const TOOLING_PROCS = /^(adb|qemu-system[\w-]*|netsimd|emulator[\w-]*|watchman)$/;

const EDITORS = [
  'Visual Studio Code', 'Cursor', 'Zed', 'WebStorm', 'Sublime Text', 'Windsurf', 'Antigravity IDE', 'Antigravity',
  'IntelliJ IDEA', 'Nova', 'Visual Studio Code - Insiders',
];
const TERMINALS = ['Terminal', 'iTerm', 'Warp', 'Ghostty', 'kitty', 'Alacritty', 'WezTerm'];
const MAX_APPS = 5;
const TERMINAL_ARGS = {
  kitty: (dir) => ['-na', 'kitty', '--args', '--directory', dir],
  Alacritty: (dir) => ['-na', 'Alacritty', '--args', '--working-directory', dir],
  WezTerm: (dir) => ['-na', 'WezTerm', '--args', 'start', '--cwd', dir],
};

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024 }, (_err, stdout) => resolve(stdout || ''));
  });
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { version: 1, settings: {}, projects: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function idFor(root) {
  return crypto.createHash('sha1').update(root).digest('hex').slice(0, 12);
}

function tildify(p) {
  return p.startsWith(HOME) ? `~${p.slice(HOME.length)}` : p;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function isCandidatePath(p) {
  if (!p || !p.startsWith(HOME + path.sep)) return false;
  const top = p.slice(HOME.length + 1).split(path.sep)[0];
  return !top.startsWith('.') && !EXCLUDED_TOP.has(top);
}

function findRoot(start) {
  if (!isCandidatePath(start)) return null;
  let dir = start.split(`${path.sep}node_modules`)[0];
  while (dir.startsWith(HOME + path.sep)) {
    if (MARKERS.some((m) => fs.existsSync(path.join(dir, m)))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function isForeignApp(command, root) {
  const i = command.indexOf('.app/Contents/');
  if (i < 0) return false;
  return !command.slice(0, i).startsWith(root + path.sep);
}

function rootFromCommand(command) {
  for (const token of command.split(/\s+/)) {
    if (!token.startsWith(HOME + path.sep)) continue;
    let p = token;
    try {
      if (fs.statSync(p).isFile()) p = path.dirname(p);
    } catch {
      continue;
    }
    const root = findRoot(p);
    if (root) return root;
  }
  return null;
}

function processName(command) {
  const tokens = command.trim().split(/\s+/);
  const base = path.basename(tokens[0] || '');
  if (base === 'node' && tokens[1] && !tokens[1].startsWith('-')) {
    return path.basename(tokens[1]).replace(/\.(c|m)?js$/, '');
  }
  return base;
}

function detectPackageManager(root) {
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectFramework(root, pkg) {
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const table = [
      ['next', 'Next.js'], ['expo', 'Expo'], ['react-native', 'React Native'], ['@react-router/dev', 'React Router'], ['@remix-run/dev', 'Remix'],
      ['nuxt', 'Nuxt'], ['@sveltejs/kit', 'SvelteKit'], ['astro', 'Astro'], ['@angular/core', 'Angular'],
      ['vite', 'Vite'], ['react-scripts', 'Create React App'], ['@nestjs/core', 'NestJS'], ['hono', 'Hono'],
      ['fastify', 'Fastify'], ['express', 'Express'], ['storybook', 'Storybook'],
    ];
    for (const [dep, label] of table) if (deps[dep]) return label;
    return 'Node';
  }
  if (fs.existsSync(path.join(root, 'manage.py'))) return 'Django';
  if (fs.existsSync(path.join(root, 'pyproject.toml')) || fs.existsSync(path.join(root, 'requirements.txt'))) return 'Python';
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) return 'Rust';
  if (fs.existsSync(path.join(root, 'go.mod'))) return 'Go';
  if (fs.existsSync(path.join(root, 'Gemfile'))) return 'Ruby';
  if (fs.existsSync(path.join(root, 'deno.json'))) return 'Deno';
  return null;
}

function describeRoot(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  const base = path.basename(root);
  const name = GENERIC_NAMES.has(base.toLowerCase()) ? `${path.basename(path.dirname(root))}/${base}` : base;
  let detectedCommand = null;
  if (pkg && pkg.scripts) {
    const script = ['dev', 'start', 'serve', 'preview'].find((s) => pkg.scripts[s]);
    if (script) {
      const pm = detectPackageManager(root);
      detectedCommand = pm === 'npm' ? `npm run ${script}` : `${pm} ${script}`;
    }
  }
  return { name, framework: detectFramework(root, pkg), detectedCommand };
}

async function processTable() {
  const out = await run('/bin/ps', ['-axo', 'pid=,ppid=,command=']);
  const table = new Map();
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (m) table.set(Number(m[1]), { ppid: Number(m[2]), command: m[3] });
  }
  return table;
}

async function liveProjects() {
  const sockets = await run('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']);
  const portsByPid = new Map();
  let pid = 0;
  for (const line of sockets.split('\n')) {
    if (line[0] === 'p') pid = Number(line.slice(1));
    else if (line[0] === 'n' && pid) {
      const port = Number(line.slice(line.lastIndexOf(':') + 1));
      if (!port) continue;
      if (!portsByPid.has(pid)) portsByPid.set(pid, new Set());
      portsByPid.get(pid).add(port);
    }
  }
  const live = new Map();
  if (!portsByPid.size) return { live, procs: new Map() };

  const [cwdOut, procs] = await Promise.all([
    run('/usr/sbin/lsof', ['-a', '-d', 'cwd', '-Fn', '-p', [...portsByPid.keys()].join(',')]),
    processTable(),
  ]);
  const cwdByPid = new Map();
  pid = 0;
  for (const line of cwdOut.split('\n')) {
    if (line[0] === 'p') pid = Number(line.slice(1));
    else if (line[0] === 'n' && pid) cwdByPid.set(pid, line.slice(1));
  }

  for (const [listenPid, ports] of portsByPid) {
    if (listenPid === process.pid) continue;
    const command = procs.get(listenPid)?.command || '';
    if (TOOLING.test(command)) continue;
    const root = findRoot(cwdByPid.get(listenPid)) || rootFromCommand(command);
    if (!root || isForeignApp(command, root)) continue;
    if (!live.has(root)) live.set(root, { pids: new Set(), ports: [] });
    const entry = live.get(root);
    entry.pids.add(listenPid);
    for (const port of ports) entry.ports.push({ port, pid: listenPid, proc: processName(command) });
  }
  return { live, procs };
}

function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function appPath(name) {
  return [
    `/Applications/${name}.app`,
    `/System/Applications/Utilities/${name}.app`,
    `/System/Applications/${name}.app`,
    path.join(HOME, 'Applications', `${name}.app`),
  ].find((p) => fs.existsSync(p));
}

async function detectApps() {
  return {
    editors: EDITORS.filter(appPath).slice(0, MAX_APPS),
    terminals: TERMINALS.filter(appPath).slice(0, MAX_APPS),
  };
}

const MOBILE_FRAMEWORKS = new Set(['Expo', 'React Native']);

async function probe(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1200), redirect: 'manual' });
    const type = res.headers.get('content-type') || '';
    if (res.status >= 300 && res.status < 400) {
      res.body?.cancel();
      return 'web';
    }
    if (!/text\/html|application\/xhtml/.test(type)) {
      res.body?.cancel();
      return 'http';
    }
    const body = (await res.text()).slice(0, 4000);
    return res.status < 400 && /<(html|body|div|script)/i.test(body) && body.length > 200 ? 'web' : 'http';
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return null;
    return 'tcp';
  }
}

function projectKind(framework, ports) {
  if (MOBILE_FRAMEWORKS.has(framework)) return 'mobile';
  if (ports.some((x) => x.kind === 'web')) return 'web';
  if (ports.some((x) => x.kind)) return 'service';
  return null;
}

async function scan() {
  const state = loadState();
  const now = Date.now();
  const { live } = await liveProjects();

  const probes = state.probes || {};
  const liveKeys = new Set();
  const pending = [];
  for (const [, entry] of live) {
    for (const x of entry.ports) {
      const key = `${x.pid}:${x.port}`;
      liveKeys.add(key);
      if (!probes[key]) pending.push(probe(x.port).then((kind) => kind && (probes[key] = kind)));
    }
  }
  await Promise.all(pending);
  for (const key of Object.keys(probes)) if (!liveKeys.has(key)) delete probes[key];
  state.probes = probes;

  for (const [root, entry] of live) {
    const id = idFor(root);
    const p = state.projects[id] || (state.projects[id] = { id, root, firstSeen: now, ports: {} });
    p.lastSeen = now;
    for (const { port, pid, proc } of entry.ports) {
      const prev = p.ports[port] || {};
      p.ports[port] = { lastSeen: now, proc, kind: probes[`${pid}:${port}`] || prev.kind || null };
    }
    if (p.spawn) p.spawn.sawLive = true;
  }

  const projects = [];
  for (const p of Object.values(state.projects)) {
    if (!fs.existsSync(p.root)) continue;
    const info = describeRoot(p.root);
    const entry = live.get(p.root);
    const liveByPort = new Map((entry?.ports || []).map((x) => [x.port, x]));
    for (const [port, v] of Object.entries(p.ports)) {
      const ephemeralAndClosed = Number(port) >= 49152 && !liveByPort.has(Number(port)) && Object.keys(p.ports).length > 1;
      if (TOOLING_PROCS.test(v.proc || '') || ephemeralAndClosed) delete p.ports[port];
    }

    let status = entry ? 'running' : 'stopped';
    if (!entry && p.spawn) {
      if (groupAlive(p.spawn.pgid)) status = 'starting';
      else if (!p.spawn.sawLive) status = 'exited';
      else delete p.spawn;
    }
    if (entry && p.spawn && !groupAlive(p.spawn.pgid)) delete p.spawn;

    const ports = Object.entries(p.ports)
      .map(([port, v]) => ({ port: Number(port), lastSeen: v.lastSeen, proc: v.proc, kind: v.kind || null, live: liveByPort.has(Number(port)) }))
      .sort((a, b) => Number(b.live) - Number(a.live) || (a.live ? a.port - b.port : b.lastSeen - a.lastSeen));

    const kind = projectKind(info.framework, ports) || p.kind || 'web';
    p.kind = kind;

    projects.push({
      id: p.id,
      kind,
      root: p.root,
      displayRoot: tildify(p.root),
      name: info.name,
      framework: info.framework,
      command: p.command || info.detectedCommand,
      customCommand: Boolean(p.command),
      status,
      ports,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      hasLog: fs.existsSync(path.join(LOG_DIR, `${p.id}.log`)),
    });
  }

  saveState(state);
  return { projects, apps: await detectApps(), home: HOME };
}

function startShell(command, cwd, logFile) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const fd = fs.openSync(logFile, 'w');
  fs.writeSync(fd, `$ ${command}\n# ${cwd}\n# ${new Date().toISOString()}\n\n`);
  const shell = process.env.SHELL || '/bin/zsh';
  const child = spawn(shell, ['-ilc', command], {
    cwd,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0' },
  });
  child.unref();
  fs.closeSync(fd);
  return child.pid;
}

async function start({ id }) {
  const state = loadState();
  const p = state.projects[id];
  if (!p) throw new Error('Unknown project');
  const command = p.command || describeRoot(p.root).detectedCommand;
  if (!command) throw new Error('No start command. Set one first.');
  const pgid = startShell(command, p.root, path.join(LOG_DIR, `${id}.log`));
  p.spawn = { pgid, startedAt: Date.now(), command, sawLive: false };
  saveState(state);
  return { ok: true };
}

function killChain(listenPid, procs) {
  const chain = [listenPid];
  let cur = procs.get(listenPid);
  while (cur && cur.ppid > 1) {
    const parent = procs.get(cur.ppid);
    if (!parent || NEVER_KILL.test(parent.command)) break;
    const base = path.basename(parent.command.trim().split(/\s+/)[0] || '');
    if (!RUNNERS.has(base) && !parent.command.startsWith('next-server')) break;
    chain.push(cur.ppid);
    cur = parent;
  }
  return chain.reverse();
}

function signal(pid, sig) {
  try {
    process.kill(pid, sig);
  } catch {}
}

async function stop({ id }) {
  const state = loadState();
  const p = state.projects[id];
  if (!p) throw new Error('Unknown project');
  const { live, procs } = await liveProjects();
  const entry = live.get(p.root);

  const targets = new Set();
  for (const pid of entry?.pids || []) {
    if (NEVER_KILL.test(procs.get(pid)?.command || '')) continue;
    for (const x of killChain(pid, procs)) targets.add(x);
  }
  const pgid = p.spawn && groupAlive(p.spawn.pgid) ? p.spawn.pgid : null;

  for (const pid of targets) signal(pid, 'SIGTERM');
  if (pgid) signal(-pgid, 'SIGTERM');

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if ([...targets].every((x) => !pidAlive(x)) && (!pgid || !groupAlive(pgid))) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  for (const pid of targets) if (pidAlive(pid)) signal(pid, 'SIGKILL');
  if (pgid && groupAlive(pgid)) signal(-pgid, 'SIGKILL');

  delete p.spawn;
  saveState(state);
  return { ok: true };
}

async function open({ id, target, app }) {
  const state = loadState();
  const p = state.projects[id];
  if (!p) throw new Error('Unknown project');
  const { editors, terminals } = await detectApps();
  const pick = (list) => (list.includes(app) ? app : list[0]);
  let args;
  if (target === 'finder') args = [p.root];
  else if (target === 'log') args = ['-a', 'Console', path.join(LOG_DIR, `${id}.log`)];
  else if (target === 'editor' && editors.length) args = ['-a', pick(editors), p.root];
  else if (target === 'terminal' && terminals.length) {
    const name = pick(terminals);
    args = TERMINAL_ARGS[name] ? TERMINAL_ARGS[name](p.root) : ['-a', name, p.root];
  }
  if (!args) throw new Error(`Can't open ${target}`);
  await run('/usr/bin/open', args);
  return { ok: true };
}

async function appIcons() {
  const { editors, terminals } = await detectApps();
  const icons = {};
  for (const name of [...editors, ...terminals]) {
    const bundle = appPath(name);
    const plist = path.join(bundle, 'Contents', 'Info.plist');
    let file = (await run('/usr/bin/plutil', ['-extract', 'CFBundleIconFile', 'raw', '-o', '-', plist])).trim();
    if (!file) continue;
    if (!file.endsWith('.icns')) file += '.icns';
    const icns = path.join(bundle, 'Contents', 'Resources', file);
    if (!fs.existsSync(icns)) continue;
    const png = path.join(DATA_DIR, `appicon-${process.pid}.png`);
    await run('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '64', icns, '--out', png]);
    if (fs.existsSync(png)) {
      icons[name] = `data:image/png;base64,${fs.readFileSync(png).toString('base64')}`;
      fs.rmSync(png, { force: true });
    }
  }
  return { icons };
}

async function setCommand({ id, command }) {
  const state = loadState();
  const p = state.projects[id];
  if (!p) throw new Error('Unknown project');
  const trimmed = (command || '').trim();
  if (trimmed) p.command = trimmed;
  else delete p.command;
  saveState(state);
  return { ok: true };
}

async function forget({ id }) {
  const state = loadState();
  delete state.projects[id];
  saveState(state);
  try {
    fs.unlinkSync(path.join(LOG_DIR, `${id}.log`));
  } catch {}
  return { ok: true };
}

async function dismiss({ id }) {
  const state = loadState();
  if (state.projects[id]) delete state.projects[id].spawn;
  saveState(state);
  return { ok: true };
}

const BROWSERS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
];

function runWithTimeout(cmd, args, ms) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: ms, maxBuffer: 8 * 1024 * 1024 }, (err) => resolve(!err));
  });
}

async function fetchIcon(origin) {
  const get = (u) => fetch(u, { signal: AbortSignal.timeout(3000), redirect: 'follow' });
  const candidates = [];
  try {
    const html = await (await get(`${origin}/`)).text();
    for (const [tag] of html.matchAll(/<link[^>]+>/gi)) {
      if (!/rel=["'][^"']*icon[^"']*["']/i.test(tag)) continue;
      const href = tag.match(/href=["']([^"']+)["']/i);
      if (href) candidates.push(new URL(href[1], `${origin}/`).href);
    }
  } catch {}
  candidates.push(`${origin}/favicon.ico`);
  for (const url of candidates) {
    try {
      const res = await get(url);
      const type = (res.headers.get('content-type') || '').split(';')[0];
      if (!res.ok || !/image|icon/.test(type)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (type === 'image/svg+xml' && !/<\/svg>\s*$/.test(buf.toString('utf8'))) continue;
      if (buf.length && buf.length < 200 * 1024) return `data:${type};base64,${buf.toString('base64')}`;
    } catch {}
  }
  return null;
}

async function thumb({ id, port }) {
  const state = loadState();
  const p = state.projects[id];
  if (!p) throw new Error('Unknown project');
  const { live } = await liveProjects();
  const ports = (live.get(p.root)?.ports || []).map((x) => x.port).sort((a, b) => a - b);
  if (!ports.length) throw new Error('Not running');
  const browser = BROWSERS.find((b) => fs.existsSync(b));
  if (!browser) throw new Error('No Chromium browser found for thumbnails');

  const origin = `http://localhost:${ports.includes(port) ? port : ports[0]}`;
  fs.rmSync(path.join(DATA_DIR, 'headless'), { recursive: true, force: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'localhost-new-tab-'));
  const png = path.join(work, 'shot.png');
  const jpg = path.join(work, 'shot.jpg');
  try {
    await runWithTimeout(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
      '--no-default-browser-check', `--user-data-dir=${path.join(work, 'profile')}`,
      '--window-size=1280,800', '--virtual-time-budget=6000', `--screenshot=${png}`, `${origin}/`,
    ], 25000);
    if (!fs.existsSync(png)) throw new Error('Screenshot failed');
    await run('/usr/bin/sips', ['-Z', '800', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', png, '--out', jpg]);
    const image = `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}`;
    return { image, icon: await fetchIcon(origin), port: Number(origin.split(':').pop()) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

async function icon({ port }) {
  return { icon: await fetchIcon(`http://localhost:${port}`) };
}

const HANDLERS = { scan, start, stop, open, setCommand, forget, dismiss, thumb, icon, appIcons };

async function handle(msg) {
  const fn = HANDLERS[msg && msg.type];
  if (!fn) return { error: `Unknown message type: ${msg && msg.type}` };
  try {
    return await fn(msg);
  } catch (e) {
    return { error: e.message };
  }
}

function readNativeMessage() {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    process.stdin.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length < 4) return;
      const len = buf.readUInt32LE(0);
      if (buf.length >= 4 + len) resolve(JSON.parse(buf.subarray(4, 4 + len).toString('utf8')));
    });
    process.stdin.on('end', () => reject(new Error('stdin closed')));
  });
}

function writeNativeMessage(msg) {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]), () => process.exit(0));
}

if (require.main !== module) {
  module.exports = { isForeignApp };
} else if (process.argv[2] === '--cli') {
  handle(JSON.parse(process.argv[3] || '{"type":"scan"}')).then((res) => {
    console.log(JSON.stringify(res, null, 2));
  });
} else {
  readNativeMessage()
    .then(handle)
    .then(writeNativeMessage)
    .catch(() => process.exit(1));
}
