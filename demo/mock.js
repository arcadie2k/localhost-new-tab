(() => {
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  if (params.has('shot')) {
    document.documentElement.classList.add('is-shot');
    document.startViewTransition = undefined;
    window.addEventListener('resize', (e) => e.stopImmediatePropagation());
    if (params.get('hide') === 'sites') document.documentElement.classList.add('shot-no-sites');
  }

  const START_MS = 1600;
  const STOP_MS = 500;
  const now = Date.now();
  const shift = now - window.DEMO.builtAt;

  const projects = window.DEMO.projects.map((p) => ({
    ...p,
    lastSeen: p.lastSeen + shift,
    firstSeen: p.firstSeen + shift,
    ports: p.ports.map((x) => ({ ...x, lastSeen: x.lastSeen + shift })),
  }));

  const store = {};
  for (const [key, value] of Object.entries(window.DEMO.media)) store[key] = { ...value, at: now };
  const listeners = [];

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const find = (id) => projects.find((p) => p.id === id);

  function tick() {
    const t = Date.now();
    for (const p of projects) {
      if (p.status === 'starting' && t - p.startedAt > START_MS) {
        p.status = 'running';
        p.lastSeen = t;
        for (const x of p.ports) Object.assign(x, { live: true, lastSeen: t });
      }
    }
  }

  const handlers = {
    scan() {
      tick();
      return { projects: clone(projects), apps: (window.SHOT && window.SHOT.apps) || window.DEMO.apps };
    },
    start({ id }) {
      const p = find(id);
      if (p) Object.assign(p, { status: 'starting', startedAt: Date.now() });
      return { ok: true };
    },
    stop({ id }) {
      const p = find(id);
      if (!p) return { ok: true };
      const t = Date.now();
      Object.assign(p, { status: 'stopped', lastSeen: t });
      for (const x of p.ports) Object.assign(x, { live: false, lastSeen: t });
      return { ok: true, delay: STOP_MS };
    },
    open({ target, app }) {
      const where = app || { finder: 'Finder', editor: 'your editor', terminal: 'Terminal', log: 'the log' }[target] || target;
      setTimeout(() => window.toast?.(`In the real extension, this opens ${where}.`), 0);
      return { ok: true };
    },
    setCommand({ id, command }) {
      const p = find(id);
      if (p) Object.assign(p, { command, customCommand: true });
      return { ok: true };
    },
    forget({ id }) {
      const i = projects.findIndex((p) => p.id === id);
      if (i >= 0) projects.splice(i, 1);
      return { ok: true };
    },
    dismiss: () => ({ ok: true }),
    appIcons: () => ({ icons: (window.SHOT && window.SHOT.icons) || {} }),
    thumb: () => ({ error: 'Previews are pre-rendered in the demo' }),
  };

  function emit(changes) {
    for (const fn of listeners) fn(changes, 'local');
  }

  const granted = new Set(params.has('granted') ? ['topSites', 'bookmarks'] : []);
  if (params.has('granted') || params.has('revoked')) {
    store.prefs = { ...(store.prefs || {}), sections: { ...((store.prefs || {}).sections || {}), mostVisited: true, bookmarks: true } };
  }
  const permListeners = { added: [], removed: [] };

  const TOP_SITES = [
    ['https://github.com/', 'GitHub'],
    ['http://localhost:3000/', 'agent-studio'],
    ['https://huggingface.co/', 'Hugging Face'],
    ['https://claude.ai/', 'Claude'],
    ['http://127.0.0.1:5173/', 'eval-dashboard'],
    ['https://vercel.com/dashboard', 'Vercel'],
    ['https://linear.app/', 'Linear'],
    ['https://www.figma.com/files', 'Figma'],
    ['https://hub.docker.com/', 'Docker Hub'],
    ['https://arxiv.org/list/cs.CL/recent', 'arXiv: Computation and Language'],
    ['https://stackoverflow.com/', 'Stack Overflow'],
    ['https://news.ycombinator.com/', 'Hacker News'],
  ].map(([url, title]) => ({ url, title }));

  let nextId = 1000;
  const bm = (title, url) => ({ title, url });
  const folder = (title, children) => ({ title, children });
  const seed = folder('', [
    folder('Bookmarks bar', [
      folder('AI stack', [
        folder('Docs', [
          bm('Claude API docs', 'https://docs.anthropic.com/'),
          bm('Hugging Face Hub', 'https://huggingface.co/docs/hub'),
          bm('FastAPI', 'https://fastapi.tiangolo.com/'),
          folder('Design', [bm('Refactoring UI', 'https://www.refactoringui.com/'), bm('Laws of UX', 'https://lawsofux.com/')]),
        ]),
        bm('Linear', 'https://linear.app/'),
        bm('Vercel', 'https://vercel.com/dashboard'),
        bm('Figma: Relay', 'https://www.figma.com/files'),
        bm('Sentry', 'https://sentry.io/'),
      ]),
      folder('Research', [
        bm('arXiv: cs.CL', 'https://arxiv.org/list/cs.CL/recent'),
        bm('Papers with Code', 'https://paperswithcode.com/'),
        folder('Reading list', [bm('Overleaf', 'https://www.overleaf.com/'), bm('Zotero', 'https://www.zotero.org/')]),
      ]),
      folder('Side projects', [bm('Product Hunt', 'https://www.producthunt.com/'), bm('Indie Hackers', 'https://www.indiehackers.com/'), bm('', 'https://www.strava.com/dashboard')]),
      bm('GitHub', 'https://github.com/'),
      bm('Gmail', 'https://mail.google.com/'),
      bm('Dark mode toggle', 'javascript:document.body.classList.toggle("dark")'),
    ]),
    folder('Other bookmarks', [
      folder('Travel', [bm('Google Flights', 'https://www.google.com/travel/flights'), bm('Hiking trails', 'https://www.alltrails.com/')]),
      bm('Hacker News', 'https://news.ycombinator.com/'),
      bm('YouTube', 'https://www.youtube.com/'),
    ]),
    folder('Mobile bookmarks', []),
  ]);
  const nodes = new Map();
  const build = (n, parentId, index, id) => {
    const node = { id, parentId, index, title: n.title, dateAdded: now };
    if (n.url !== undefined) node.url = n.url;
    nodes.set(id, node);
    if (n.children) node.children = n.children.map((c, i) => build(c, id, i, String(nextId++)));
    return node;
  };
  const bmRoot = build(seed, undefined, 0, '0');
  bmRoot.children.forEach((c, i) => {
    nodes.delete(c.id);
    c.id = String(i + 1);
    nodes.set(c.id, c);
    c.children.forEach((k) => (k.parentId = c.id));
  });
  const bmListeners = { onCreated: [], onRemoved: [], onChanged: [], onMoved: [], onChildrenReordered: [] };
  const fire = (ev, ...args) => setTimeout(() => bmListeners[ev].forEach((fn) => fn(...args)), 0);
  const reindex = (parent) => parent.children.forEach((c, i) => (c.index = i));
  const strip = (n) => clone(n);
  const descendants = (n) => [n, ...(n.children || []).flatMap(descendants)];
  const bookmarksApi = {
    async getTree() {
      return [strip(bmRoot)];
    },
    async getSubTree(id) {
      const n = nodes.get(id);
      if (!n) throw new Error("Can't find bookmark for id.");
      return [strip(n)];
    },
    async search(q) {
      const needle = String(typeof q === 'string' ? q : q.query || '').toLowerCase();
      return [...nodes.values()].filter((n) => n.url && ((n.title || '').toLowerCase().includes(needle) || n.url.toLowerCase().includes(needle))).map(strip);
    },
    async create({ parentId = '2', index, title = '', url }) {
      const parent = nodes.get(parentId);
      if (!parent || !parent.children || parentId === '0') throw new Error('Invalid parent');
      const node = { id: String(nextId++), parentId, title, dateAdded: Date.now() };
      if (url !== undefined) node.url = url;
      else node.children = [];
      const at = index === undefined ? parent.children.length : Math.min(index, parent.children.length);
      parent.children.splice(at, 0, node);
      reindex(parent);
      nodes.set(node.id, node);
      fire('onCreated', node.id, strip(node));
      return strip(node);
    },
    async update(id, changes) {
      const n = nodes.get(id);
      if (!n || id === '0' || n.parentId === '0') throw new Error("Can't modify the root bookmark folders.");
      if (changes.title !== undefined) n.title = changes.title;
      if (changes.url !== undefined && n.url !== undefined) n.url = changes.url;
      fire('onChanged', id, { title: n.title, url: n.url });
      return strip(n);
    },
    async move(id, { parentId, index }) {
      const n = nodes.get(id);
      if (!n || n.parentId === '0' || id === '0') throw new Error("Can't modify the root bookmark folders.");
      const from = nodes.get(n.parentId);
      const to = nodes.get(parentId || n.parentId);
      if (!to || !to.children || to.id === '0' || descendants(n).includes(to)) throw new Error('Invalid move');
      const oldIndex = from.children.indexOf(n);
      let at = index === undefined ? to.children.length : index;
      if (from === to && at > oldIndex) at -= 1;
      from.children.splice(oldIndex, 1);
      to.children.splice(Math.min(at, to.children.length), 0, n);
      n.parentId = to.id;
      reindex(from);
      reindex(to);
      fire('onMoved', id, { parentId: to.id, index: n.index, oldParentId: from.id, oldIndex });
      return strip(n);
    },
    async remove(id) {
      const n = nodes.get(id);
      if (!n) throw new Error("Can't find bookmark for id.");
      if (n.children && n.children.length) throw new Error("Can't remove non-empty folder (use recursive to force).");
      return bookmarksApi.removeTree(id);
    },
    async removeTree(id) {
      const n = nodes.get(id);
      if (!n || n.parentId === '0' || id === '0') throw new Error("Can't modify the root bookmark folders.");
      const parent = nodes.get(n.parentId);
      const index = parent.children.indexOf(n);
      parent.children.splice(index, 1);
      reindex(parent);
      descendants(n).forEach((d) => nodes.delete(d.id));
      fire('onRemoved', id, { parentId: parent.id, index, node: strip(n) });
    },
  };
  for (const ev of Object.keys(bmListeners)) bookmarksApi[ev] = { addListener: (fn) => bmListeners[ev].push(fn) };

  window.chrome = {
    tabs: {
      async update({ url }) {
        setTimeout(() => window.toast?.(`In the real extension, this opens ${url}.`), 0);
      },
      async create({ url }) {
        setTimeout(() => window.toast?.(`In the real extension, this opens ${url} in a new tab.`), 0);
      },
    },
    bookmarks: bookmarksApi,
    topSites: {
      async get() {
        return clone(TOP_SITES);
      },
    },
    permissions: {
      async contains({ permissions }) {
        return permissions.every((p) => granted.has(p));
      },
      async request({ permissions }) {
        await new Promise((r) => setTimeout(r, 150));
        if (params.has('decline')) return false;
        permissions.forEach((p) => granted.add(p));
        for (const fn of permListeners.added) fn({ permissions });
        return true;
      },
      async remove({ permissions }) {
        permissions.forEach((p) => granted.delete(p));
        for (const fn of permListeners.removed) fn({ permissions });
        return true;
      },
      onAdded: { addListener: (fn) => permListeners.added.push(fn) },
      onRemoved: { addListener: (fn) => permListeners.removed.push(fn) },
    },
    runtime: {
      getURL: () => 'data:,',
      id: params.has('setup') ? 'iafmjppjfdddcnlanldpmjejhpbikdem' : 'demo',
      lastError: null,
      sendNativeMessage(_host, msg, cb) {
        if (params.has('setup')) {
          setTimeout(() => {
            window.chrome.runtime.lastError = { message: 'Specified native messaging host not found.' };
            cb(undefined);
            window.chrome.runtime.lastError = null;
          }, 60);
          return;
        }
        const res = (handlers[msg.type] || (() => ({ error: `Unknown message ${msg.type}` })))(msg);
        setTimeout(() => cb(res), res.delay || 60);
      },
    },
    storage: {
      local: {
        get(_keys, cb) {
          const items = clone(store);
          cb?.(items);
          return Promise.resolve(items);
        },
        async set(items) {
          const changes = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          }
          emit(changes);
        },
        async remove(keys) {
          const changes = {};
          for (const k of [].concat(keys)) {
            changes[k] = { oldValue: store[k] };
            delete store[k];
          }
          emit(changes);
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };

  const realFavicon = (img) => {
    const src = img.getAttribute('src') || '';
    const i = src.indexOf('pageUrl=');
    if (i < 0) return;
    try {
      const host = new URL(decodeURIComponent(src.slice(i + 8).split('&')[0])).hostname;
      img.src = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    } catch {}
  };
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) n.querySelectorAll?.('.fav img').forEach(realFavicon);
  }).observe(document.documentElement, { childList: true, subtree: true });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tap = (el) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  window.addEventListener('load', async () => {
    if (![...params.keys()].some((k) => ['tab', 'expand', 'menu', 'settings', 'view'].includes(k))) return;
    await wait(900);
    if (params.get('view') === 'list') {
      tap(document.querySelector('.view-btn[data-view="list"]'));
      await wait(200);
    }
    if (params.has('expand')) tap(document.querySelector('.site-more'));
    if (params.get('tab') === 'bookmarks') {
      tap(document.querySelector('.tab-btn[data-tab="bookmarks"]'));
      await wait(300);
      for (const name of (params.get('open') || '').split('/').filter(Boolean)) {
        const cols = document.querySelectorAll('.bm-col');
        const row = [...cols[cols.length - 1].querySelectorAll('.bm-row.is-folder')].find((r) => r.textContent.trim() === name);
        tap(row);
        await wait(150);
      }
      if (params.get('scroll') === 'start') {
        await wait(400);
        const box = document.getElementById('bm-columns');
        box.style.scrollBehavior = 'auto';
        box.scrollLeft = 0;
      }
    }
    await wait(800);
    const menu = params.get('menu');
    if (menu) {
      const [id, action] = menu.split(':');
      tap(document.querySelector(`.card[data-id="${id}"] [data-action="${action}"]`));
    }
    if (params.has('settings')) tap(document.getElementById('settings-btn'));
    await wait(50);
    if (params.has('shot')) document.activeElement?.blur();
  });
})();
