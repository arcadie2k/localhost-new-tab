(() => {
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  if (params.has('shot')) {
    document.documentElement.classList.add('is-shot');
    document.startViewTransition = undefined;
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
      return { projects: clone(projects), apps: window.DEMO.apps };
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
    appIcons: () => ({ icons: {} }),
    thumb: () => ({ error: 'Previews are pre-rendered in the demo' }),
  };

  function emit(changes) {
    for (const fn of listeners) fn(changes, 'local');
  }

  window.chrome = {
    runtime: {
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
})();
