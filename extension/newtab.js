'use strict';

const HOST = 'com.arcadie.localhost_newtab';
const POLL_MS = 3000;
const FAST_POLL_MS = 1000;
const THUMB_STALE_MS = 30 * 60 * 1000;
const THUMB_SETTLE_MS = 5000;

const ICONS = {
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
  log: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01"/><path d="M6 17h.01"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
};

const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const $ = (id) => document.getElementById(id);

const PLATFORM = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
const FOLDER_LABEL = /win/i.test(PLATFORM) ? 'Show in File Explorer' : /mac/i.test(PLATFORM) ? 'Show in Finder' : 'Open folder';

const state = {
  projects: [],
  apps: {},
  query: '',
  pending: new Map(),
  notes: new Map(),
  editing: null,
  menuFor: null,
  loaded: false,
  layout: '',
  transitioning: false,
  media: {},
  runningSince: new Map(),
  thumbTried: new Set(),
  view: 'grid',
  thumbBusy: false,
};

const cardCache = new WeakMap();
let pollTimer = null;
let toastTimer = null;

function host(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(HOST, msg, (res) => {
      const err = chrome.runtime.lastError;
      if (err) reject(Object.assign(new Error(err.message), { native: true }));
      else if (res && res.error) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function appsOf(kind) {
  const list = (kind === 'editor' ? state.apps.editors : state.apps.terminals) || [];
  const last = state.media.prefs && state.media.prefs[kind];
  return last && list.includes(last) ? [last, ...list.filter((x) => x !== last)] : list;
}

async function rememberApp(kind, app) {
  const prefs = { ...(state.media.prefs || {}), [kind]: app };
  state.media.prefs = prefs;
  await chrome.storage?.local.set({ prefs });
}

async function loadAppIcons() {
  const names = [...(state.apps.editors || []), ...(state.apps.terminals || [])];
  const have = (state.media.appIcons && state.media.appIcons.icons) || {};
  if (!names.length || names.every((n) => n in have) || state.appIconsLoading) return;
  state.appIconsLoading = true;
  try {
    const { icons } = await host({ type: 'appIcons' });
    const all = { ...have };
    for (const n of names) all[n] = icons[n] || null;
    state.media.appIcons = { icons: all };
    await chrome.storage?.local.set({ appIcons: { icons: all } });
  } catch {}
  state.appIconsLoading = false;
}

const EPHEMERAL = 49152;
const KIND_RANK = { web: 0, http: 1, null: 2, tcp: 3 };

function primaryPort(p) {
  const pool = p.ports.some((x) => x.live) ? p.ports.filter((x) => x.live) : p.ports;
  const score = (x) => (KIND_RANK[x.kind] ?? 2) + (x.port >= EPHEMERAL ? 10 : 0);
  return [...pool].sort((a, b) => score(a) - score(b) || (a.live ? a.port - b.port : b.lastSeen - a.lastSeen))[0] || null;
}

function livePort(p) {
  const x = primaryPort(p);
  return x && x.live ? x : null;
}

function portLabel(p, x) {
  if (p.kind === 'mobile' && (x.port === 8081 || /metro|expo|react-native|^cli$/i.test(x.proc || ''))) return 'Metro bundler';
  return { web: 'Web app', http: 'HTTP service', tcp: 'TCP' }[x.kind] || 'Port';
}

function kindLabel(p) {
  return { service: 'Service', mobile: 'Mobile' }[p.kind] || null;
}

function isWeb(p) {
  return !p.kind || p.kind === 'web';
}

function portOwner(port, exceptId) {
  return state.projects.find((o) => o.id !== exceptId && o.ports.some((x) => x.live && x.port === port));
}

function effectiveStatus(p) {
  if (state.pending.get(p.id) === 'starting' && p.status !== 'running') return 'starting';
  return p.status;
}

function pinnedIds() {
  return (state.media.pins && state.media.pins.ids) || [];
}

function isPinned(p) {
  return pinnedIds().includes(p.id);
}

async function togglePin(p) {
  const ids = pinnedIds();
  const next = ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id];
  state.media.pins = { ids: next };
  render();
  await chrome.storage?.local.set({ pins: { ids: next } });
}

function media(kind, id) {
  const m = state.media[`${kind}:${id}`];
  return m && m.url ? m : null;
}

/* Rendering */

function thumbHTML(p, status, live, extra) {
  const shot = media('thumb', p.id);
  const avatarIcon = media('icon', p.id);
  const inner = shot
    ? `<img class="shot" data-media="thumb:${p.id}" data-at="${shot.at}" alt="" draggable="false">`
    : `<div class="placeholder">
        <span class="avatar avatar-lg${avatarIcon ? " has-icon" : ""}">${avatarIcon ? `<img data-media="icon:${p.id}" data-at="${avatarIcon.at}" alt="">` : esc(p.name[0].toUpperCase())}</span>
        ${status === 'running' ? '<span class="placeholder-hint">Capturing preview</span>' : ''}
      </div>`;

  if (live && !extra) {
    return `<a class="thumb" href="http://localhost:${live.port}/" aria-label="Open ${esc(p.name)} on localhost:${live.port}">
      ${inner}
    </a>`;
  }
  return `<div class="thumb">${inner}${extra}</div>`;
}

function primaryHTML(p, status) {
  const pending = state.pending.get(p.id);
  if (pending === 'stopping') return `<button class="bar-btn bar-primary" disabled>${icon('spinner', 'spin')}Stopping</button>`;
  if (status === 'running') return `<button class="bar-btn bar-primary" data-action="stop" data-tip="Stop the dev server">${icon('stop')}Stop</button>`;
  if (status === 'starting') return `<button class="bar-btn bar-primary" data-action="stop" data-tip="Cancel start">${icon('spinner', 'spin')}Starting</button>`;
  if (!p.command) return `<button class="bar-btn bar-primary" data-action="edit" data-tip="Choose how to start this project">Set command</button>`;
  return `<button class="bar-btn bar-primary" data-action="start" data-tip="Run ${esc(p.command)}">${icon('play')}Start</button>`;
}

function extraHTML(p, status) {
  const note = state.notes.get(p.id);
  if (state.editing === p.id) {
    return `<div class="card-extra">
      <input class="command-input" data-role="command" value="${esc(p.command || '')}" placeholder="pnpm dev" spellcheck="false" aria-label="Start command">
      <div class="extra-actions">
        <button class="bar-btn" data-action="save-command">Save</button>
        <button class="bar-btn" data-action="cancel-edit">Cancel</button>
      </div>
    </div>`;
  }
  if (note && note.type === 'conflict') {
    return `<div class="card-extra">
      <p class="note">:${note.port} is in use by <strong>${esc(note.ownerName)}</strong>.</p>
      <div class="extra-actions">
        <button class="bar-btn" data-action="swap">Stop it and start</button>
        <button class="bar-btn" data-action="force-start">Start anyway</button>
        <button class="bar-btn" data-action="dismiss-note">Cancel</button>
      </div>
    </div>`;
  }
  if (status === 'exited') {
    return `<div class="card-extra">
      <p class="note">Exited before opening a port.</p>
      <div class="extra-actions">
        <button class="bar-btn" data-action="log">${icon('log')}View log</button>
        <button class="bar-btn" data-action="dismiss-exit">Dismiss</button>
      </div>
    </div>`;
  }
  return '';
}

function cardHTML(p) {
  const status = effectiveStatus(p);
  const live = livePort(p);
  const avatarIcon = media('icon', p.id);
  const pinned = isPinned(p);
  const row = state.view === 'list';
  const compact = !isWeb(p) || row;

  const main = primaryPort(p);
  const typeLabel = compact ? (main && main.kind ? portLabel(p, main) : kindLabel(p)) : null;
  const sub = [p.framework, typeLabel, status === 'running' ? 'now' : status === 'starting' ? 'starting' : ago(p.lastSeen)]
    .filter(Boolean)
    .map(esc)
    .join('<span class="sep">·</span>');

  const others = p.ports.length - (main ? 1 : 0);
  const mainHTML = !main
    ? ''
    : main.live && main.kind !== 'tcp'
      ? `<a class="port" href="http://localhost:${main.port}/" data-tip="Open localhost:${main.port} · ${esc(portLabel(p, main))}">:${main.port}</a>`
      : `<span class="port${main.live ? '' : ' is-idle'}" data-tip="${main.live ? esc(portLabel(p, main)) : `Last used ${esc(ago(main.lastSeen))}`}">:${main.port}</span>`;
  const moreHTML = others > 0
    ? `<button class="port-more" data-action="ports" data-tip="All ports" aria-label="Show all ${p.ports.length} ports" aria-haspopup="menu">+${others}</button>`
    : '';


  const editors = appsOf('editor');
  const editorTitle = editors.length === 1 ? `Open in ${editors[0]}` : 'Open in editor';
  const editorBtn = editors.length
    ? `<button class="bar-btn" data-action="editor" data-tip="${esc(editorTitle)}" aria-label="${esc(editorTitle)}" aria-haspopup="${editors.length > 1 ? 'menu' : 'false'}">${icon('code')}</button>`
    : '';

  const avatar = avatarIcon
    ? `<span class="avatar has-icon"><img data-media="icon:${p.id}" data-at="${avatarIcon.at}" alt=""></span>`
    : !isWeb(p)
      ? `<span class="avatar kind-tile">${icon(p.kind === 'mobile' ? 'phone' : 'server')}</span>`
      : `<span class="avatar">${esc(p.name[0].toUpperCase())}</span>`;

  const statusLabel = status === 'running' ? 'Running' : status === 'starting' ? 'Starting' : '';
  const avatarBlock = statusLabel
    ? `<span class="avatar-wrap" data-tip="${statusLabel}">${avatar}<span class="status-dot${status === 'starting' ? ' is-starting' : ''}" role="img" aria-label="${statusLabel}"></span></span>`
    : `<span class="avatar-wrap">${avatar}</span>`;

  const extra = extraHTML(p, status);

  return `<li class="card${compact ? ' is-compact' : ''}${row ? ' is-row' : ''}" data-id="${esc(p.id)}" data-status="${status}"${pinned ? ' data-pinned' : ''} style="view-transition-name: card-${esc(p.id)}">
    ${compact ? '' : thumbHTML(p, status, live, extra)}
    <div class="card-body">
      <div class="card-head">
        ${avatarBlock}
        <div class="titles">
          <div class="name-row">
            <span class="name" data-tip="${esc(p.displayRoot)}">${esc(p.name)}</span>
          </div>
          <div class="sub">${sub}</div>
        </div>
        <button class="pin-btn" data-action="pin" aria-pressed="${pinned}" data-tip="${pinned ? 'Unpin' : 'Pin to top'}" aria-label="${pinned ? 'Unpin' : 'Pin to top'}">${icon('pin')}</button>
      </div>
    </div>
    ${compact ? extra.replace('class="card-extra"', 'class="card-extra is-inline"') : ''}
    <div class="card-bar">
      <div class="ports">${mainHTML}${moreHTML}</div>
      <button class="bar-btn" data-action="finder" data-tip="${FOLDER_LABEL}" aria-label="${FOLDER_LABEL}">${icon('folder')}</button>
      ${editorBtn}
      <button class="bar-btn" data-action="menu" data-tip="More actions" aria-label="More actions" aria-haspopup="menu">${icon('more')}</button>
      ${primaryHTML(p, status)}
    </div>
  </li>`;
}

function hydrate(el) {
  el.querySelectorAll('img[data-media]').forEach((img) => {
    const key = img.dataset.media;
    const m = state.media[key];
    if (!m) return;
    img.addEventListener('error', () => dropMedia(key), { once: true });
    img.src = m.url;
  });
}

function dropMedia(key) {
  if (!state.media[key]) return;
  delete state.media[key];
  chrome.storage?.local.remove(key);
  const id = key.slice(key.indexOf(':') + 1);
  state.thumbTried.delete(id);
  render();
}

function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function renderGrid(container, items) {
  const existing = new Map([...container.children].map((el) => [el.dataset.id, el]));
  items.forEach((p, i) => {
    const html = cardHTML(p);
    let el = existing.get(p.id);
    const typingInside = el && el.contains(document.activeElement) && document.activeElement.matches('input');
    if (!typingInside && (!el || cardCache.get(el) !== html)) {
      const next = fromHTML(html);
      cardCache.set(next, html);
      hydrate(next);
      if (el) {
        if (el.classList.contains('is-menu-open')) next.classList.add('is-menu-open');
        el.replaceWith(next);
      } else if (state.loaded && !state.transitioning) {
        next.classList.add('enter');
      }
      el = next;
    }
    existing.delete(p.id);
    if (container.children[i] !== el) container.insertBefore(el, container.children[i] || null);
  });
  existing.forEach((el) => el.remove());
}

function matches(p) {
  if (!state.query) return true;
  const q = state.query.toLowerCase();
  return (
    p.name.toLowerCase().includes(q) ||
    p.displayRoot.toLowerCase().includes(q) ||
    (p.framework || '').toLowerCase().includes(q) ||
    (kindLabel(p) || '').toLowerCase().includes(q) ||
    p.ports.some((x) => String(x.port).includes(q.replace(/^:/, '')))
  );
}

function render() {
  const all = state.projects;
  const isUp = (p) => ['running', 'starting'].includes(effectiveStatus(p)) || state.pending.get(p.id) === 'stopping';
  const web = all.filter(isWeb);
  const pinned = web.filter(isPinned).sort((a, b) => a.name.localeCompare(b.name));
  const running = web.filter((p) => !isPinned(p) && isUp(p)).sort((a, b) => a.name.localeCompare(b.name));
  const recent = web.filter((p) => !isPinned(p) && !isUp(p)).sort((a, b) => b.lastSeen - a.lastSeen);
  const services = all
    .filter((p) => !isWeb(p))
    .sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || Number(isUp(b)) - Number(isUp(a)) || b.lastSeen - a.lastSeen);
  const liveCount = all.filter((p) => p.status === 'running').length;

  $('headline').textContent = liveCount ? `${liveCount} running` : 'Nothing running';
  $('lede').textContent = all.length
    ? `${all.length} ${all.length === 1 ? 'project' : 'projects'} on localhost`
    : 'Start a dev server anywhere in your home folder and it shows up here.';

  $('search').hidden = all.length < 2;
  $('tools').hidden = !all.length;
  $('app').dataset.view = state.view;
  for (const btn of document.querySelectorAll('.view-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.view === state.view));
  $('setup').hidden = true;

  const pinnedShown = pinned.filter(matches);
  const servicesShown = services.filter(matches);
  const runningShown = running.filter(matches);
  const recentShown = recent.filter(matches);

  const apply = () => {
    $('section-services').hidden = !servicesShown.length;
    $('count-services').textContent = servicesShown.length;
    renderGrid($('grid-services'), servicesShown);
    $('section-pinned').hidden = !pinnedShown.length;
    $('count-pinned').textContent = pinnedShown.length;
    renderGrid($('grid-pinned'), pinnedShown);
    $('section-running').hidden = !runningShown.length;
    $('section-recent').hidden = !recentShown.length;
    $('count-running').textContent = runningShown.length;
    $('count-recent').textContent = recentShown.length;
    renderGrid($('grid-running'), runningShown);
    renderGrid($('grid-recent'), recentShown);

    const empty = $('empty');
    empty.hidden = !all.length || pinnedShown.length || runningShown.length || servicesShown.length || recentShown.length;
    if (!empty.hidden) {
      empty.textContent = `Nothing matches “${state.query}”.`;
    }
  };

  const layout = [pinnedShown, runningShown, servicesShown, recentShown].map((list) => list.map((p) => p.id).join(',')).join('|');
  const animate = state.loaded && layout !== state.layout && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.layout = layout;
  if (animate) {
    closeMenu(true);
    state.transitioning = true;
    const transition = document.startViewTransition(apply);
    transition.ready.catch(() => {});
    transition.finished.finally(() => {
      state.transitioning = false;
    });
  } else {
    apply();
  }

  $('app').removeAttribute('aria-busy');
  state.loaded = true;
}

function renderSetup(err) {
  $('headline').textContent = 'Connect the helper.';
  $('lede').textContent = 'One command, once.';
  $('search').hidden = true;
  $('tools').hidden = true;
  $('section-pinned').hidden = true;
  $('section-services').hidden = true;
  $('section-running').hidden = true;
  $('section-recent').hidden = true;
  $('empty').hidden = true;
  $('setup').hidden = false;
  const version = chrome.runtime.getManifest?.().version || '1.0.0';
  $('setup-command').textContent = `curl -fsSL https://raw.githubusercontent.com/arcadie2k/localhost-new-tab/v${version}/install.sh | sh -s -- ${chrome.runtime.id}`;
  $('setup-error').textContent = err ? err.message : '';
  $('app').removeAttribute('aria-busy');
}

/* Thumbnails */

function needsThumb(p) {
  if (!isWeb(p)) return false;
  if (p.status !== 'running' || state.thumbTried.has(p.id)) return false;
  const since = state.runningSince.get(p.id);
  if (!since || Date.now() - since < THUMB_SETTLE_MS) return false;
  const shot = media('thumb', p.id);
  return !shot || Date.now() - shot.at > THUMB_STALE_MS;
}

async function captureThumb(p, { force = false } = {}) {
  if (state.thumbBusy || !chrome.storage) return;
  state.thumbBusy = true;
  state.thumbTried.add(p.id);
  try {
    const res = await host({ type: 'thumb', id: p.id, port: primaryPort(p)?.port });
    const update = { [`thumb:${p.id}`]: { url: res.image, at: Date.now(), source: 'headless' } };
    if (res.icon) update[`icon:${p.id}`] = { url: res.icon, at: Date.now() };
    await chrome.storage.local.set(update);
  } catch (e) {
    if (force) toast(`Couldn't capture preview: ${e.message}`);
  } finally {
    state.thumbBusy = false;
  }
  const next = state.projects.find(needsThumb);
  if (next) captureThumb(next);
}

function trackRunning() {
  const now = Date.now();
  for (const p of state.projects) {
    if (p.status === 'running') {
      if (!state.runningSince.has(p.id)) state.runningSince.set(p.id, now);
    } else {
      state.runningSince.delete(p.id);
      state.thumbTried.delete(p.id);
    }
  }
  const next = state.projects.find(needsThumb);
  if (next) captureThumb(next);
}

chrome.storage?.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (newValue) state.media[key] = newValue;
    else delete state.media[key];
  }
  if (state.loaded) render();
});

/* Data */

async function refresh() {
  try {
    const res = await host({ type: 'scan' });
    state.projects = res.projects;
    state.apps = res.apps || {};
    loadAppIcons();
    for (const [id, kind] of state.pending) {
      const p = res.projects.find((x) => x.id === id);
      if (!p || (kind === 'starting' && p.status !== 'starting')) state.pending.delete(id);
    }
    trackRunning();
    render();
  } catch (e) {
    if (e.native) renderSetup(e);
    else toast(e.message);
  }
  schedule();
}

function schedule() {
  clearTimeout(pollTimer);
  if (document.hidden) return;
  const fast = state.projects.some((p) => p.status === 'starting') || state.pending.size;
  pollTimer = setTimeout(refresh, fast ? FAST_POLL_MS : POLL_MS);
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3600);
}

function byId(id) {
  return state.projects.find((p) => p.id === id);
}

/* Actions */

async function startProject(p, { checkConflict = true } = {}) {
  const recentPort = primaryPort(p);
  if (checkConflict && recentPort) {
    const owner = portOwner(recentPort.port, p.id);
    if (owner) {
      state.notes.set(p.id, { type: 'conflict', port: recentPort.port, ownerId: owner.id, ownerName: owner.name });
      render();
      return;
    }
  }
  state.notes.delete(p.id);
  state.pending.set(p.id, 'starting');
  p.status = 'starting';
  render();
  try {
    await host({ type: 'start', id: p.id });
  } catch (e) {
    state.pending.delete(p.id);
    toast(`Couldn't start ${p.name}: ${e.message}`);
  }
  refresh();
}

async function stopProject(p) {
  state.pending.set(p.id, 'stopping');
  render();
  try {
    await host({ type: 'stop', id: p.id });
  } catch (e) {
    toast(`Couldn't stop ${p.name}: ${e.message}`);
  }
  state.pending.delete(p.id);
  await refresh();
}

async function openTarget(p, target, app) {
  try {
    await host({ type: 'open', id: p.id, target, app });
  } catch (e) {
    toast(e.message);
  }
}

function beginEdit(p) {
  closeMenu();
  state.editing = p.id;
  state.notes.delete(p.id);
  render();
  const input = document.querySelector(`.card[data-id="${p.id}"] [data-role="command"]`);
  if (input) {
    input.focus();
    input.select();
  }
}

async function saveCommand(p) {
  const input = document.querySelector(`.card[data-id="${p.id}"] [data-role="command"]`);
  const command = input ? input.value : '';
  state.editing = null;
  try {
    await host({ type: 'setCommand', id: p.id, command });
    toast(command.trim() ? 'Start command saved.' : 'Start command cleared.');
  } catch (e) {
    toast(e.message);
  }
  refresh();
}

async function forgetProject(p) {
  closeMenu();
  try {
    await host({ type: 'forget', id: p.id });
    if (isPinned(p)) await togglePin(p);
    await chrome.storage?.local.remove([`thumb:${p.id}`, `icon:${p.id}`]);
    toast(`Removed ${p.name}.`);
  } catch (e) {
    toast(e.message);
  }
  refresh();
}

async function handleAction(action, p, trigger) {
  switch (action) {
    case 'start':
      return startProject(p);
    case 'force-start':
      return startProject(p, { checkConflict: false });
    case 'swap': {
      const note = state.notes.get(p.id);
      const owner = note && byId(note.ownerId);
      state.notes.delete(p.id);
      if (owner) await stopProject(owner);
      return startProject(byId(p.id) || p, { checkConflict: false });
    }
    case 'dismiss-note':
      state.notes.delete(p.id);
      return render();
    case 'stop':
      return stopProject(p);
    case 'finder':
    case 'log':
      closeMenu();
      return openTarget(p, action);
    case 'editor':
    case 'terminal': {
      const apps = appsOf(action);
      if (apps.length <= 1) {
        closeMenu();
        return openTarget(p, action, apps[0]);
      }
      const anchor = trigger.closest('#menu') ? state.menuTrigger : trigger;
      if (state.menuFor === p.id && state.menuKind === action) return closeMenu();
      return openChooser(p, anchor, action);
    }
    case 'open-app':
      closeMenu();
      rememberApp(trigger.dataset.kind, trigger.dataset.app);
      return openTarget(p, trigger.dataset.kind, trigger.dataset.app);
    case 'ports':
      if (state.menuFor === p.id && state.menuKind === 'ports') return closeMenu();
      return openPorts(p, trigger);
    case 'menu-back':
      return openMenu(p, state.menuTrigger);
    case 'dismiss-exit':
      p.status = 'stopped';
      render();
      await host({ type: 'dismiss', id: p.id }).catch(() => {});
      return refresh();
    case 'edit':
      return beginEdit(p);
    case 'save-command':
      return saveCommand(p);
    case 'cancel-edit':
      state.editing = null;
      return render();
    case 'copy-path':
      closeMenu();
      await navigator.clipboard.writeText(p.root);
      return toast('Path copied.');
    case 'refresh-thumb':
      closeMenu();
      toast('Capturing preview…');
      return captureThumb(p, { force: true });
    case 'forget':
      return forgetProject(p);
    case 'pin':
      closeMenu();
      return togglePin(p);
    case 'menu':
      return state.menuFor === p.id && state.menuKind === 'menu' ? closeMenu() : openMenu(p, trigger);
  }
}

/* Menu */

function menuItem(action, iconName, label) {
  return `<button class="menu-item" role="menuitem" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
}

function showMenu(p, trigger, kind, html) {
  closeMenu(true);
  const menu = $('menu');
  menu.innerHTML = html;
  menu.dataset.id = p.id;
  menu.classList.remove('is-closing');
  menu.hidden = false;

  const r = trigger.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const below = r.bottom + 6 + m.height < window.innerHeight;
  menu.style.top = `${below ? r.bottom + 6 : r.top - 6 - m.height}px`;
  menu.style.left = `${Math.min(window.innerWidth - m.width - 16, Math.max(16, r.right - m.width))}px`;
  menu.style.transformOrigin = below ? 'top right' : 'bottom right';

  state.menuFor = p.id;
  state.menuKind = kind;
  state.menuTrigger = trigger;
  trigger.closest('.card')?.classList.add('is-menu-open');
  trigger.setAttribute('aria-expanded', 'true');
  menu.querySelector('.menu-item')?.focus({ preventScroll: true });
  hideTip();
}

function openMenu(p, trigger) {
  const terminals = appsOf('terminal');
  const items = [
    terminals.length > 1
      ? `<button class="menu-item" role="menuitem" data-action="terminal" aria-haspopup="menu">${icon('terminal')}<span>Open in terminal</span>${icon('chevron', 'menu-chevron')}</button>`
      : menuItem('terminal', 'terminal', `Open in ${esc(terminals[0] || 'Terminal')}`),
    menuItem('copy-path', 'copy', 'Copy path'),
  ];
  if (p.status === 'running') items.push(menuItem('refresh-thumb', 'refresh', 'Refresh preview'));
  if (p.status !== 'running') {
    items.push('<div class="menu-sep" role="separator"></div>');
    items.push(menuItem('forget', 'trash', 'Remove from list'));
  }
  showMenu(p, trigger, 'menu', items.join(''));
}

function openPorts(p, trigger) {
  const main = primaryPort(p);
  const sorted = [...p.ports].sort((a, b) => Number(b.live) - Number(a.live) || (a === main ? -1 : b === main ? 1 : a.port - b.port));
  const rows = sorted.map((x) => {
    const label = `${esc(portLabel(p, x))}${x.proc ? ` · ${esc(x.proc)}` : ''}`;
    const right = x.live ? '<span class="port-state is-live">live</span>' : `<span class="port-state">${esc(ago(x.lastSeen))}</span>`;
    const inner = `<span class="port-num">:${x.port}</span><span class="port-desc">${label}</span>${right}`;
    return x.live && x.kind !== 'tcp'
      ? `<a class="menu-item port-row" role="menuitem" href="http://localhost:${x.port}/">${inner}</a>`
      : `<div class="menu-item port-row is-static" role="menuitem" aria-disabled="true">${inner}</div>`;
  });
  showMenu(p, trigger, 'ports', `<div class="menu-label">Ports</div>${rows.join('')}`);
}

function openChooser(p, trigger, kind) {
  const apps = appsOf(kind);
  const icons = (state.media.appIcons && state.media.appIcons.icons) || {};
  const last = state.media.prefs && state.media.prefs[kind];
  const fromMenu = kind === 'terminal' && state.menuKind === 'menu' && state.menuFor === p.id;
  const header = fromMenu
    ? `<button class="menu-item menu-back" role="menuitem" data-action="menu-back">${icon('back')}<span>Open in terminal</span></button><div class="menu-sep" role="separator"></div>`
    : `<div class="menu-label">Open in</div>`;
  const items = apps.map((name) => {
    const img = icons[name] ? `<img class="app-icon" src="${icons[name]}" alt="">` : icon(kind === 'editor' ? 'code' : 'terminal');
    const current = name === last ? icon('check', 'menu-check') : '';
    return `<button class="menu-item" role="menuitem" data-action="open-app" data-kind="${kind}" data-app="${esc(name)}">${img}<span>${esc(name)}</span>${current}</button>`;
  });
  showMenu(p, trigger, kind, header + items.join(''));
}

function closeMenu(immediate = false) {
  const menu = $('menu');
  if (menu.hidden) return;
  document.querySelectorAll('.card.is-menu-open').forEach((el) => el.classList.remove('is-menu-open'));
  document.querySelectorAll('[aria-expanded="true"]').forEach((el) => el.removeAttribute('aria-expanded'));
  state.menuFor = null;
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    menu.hidden = true;
    return;
  }
  menu.classList.add('is-closing');
  const finish = () => {
    if (menu.classList.contains('is-closing')) menu.hidden = true;
  };
  menu.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 250);
}

/* Events */

document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  const inMenu = e.target.closest('#menu');
  const opensMenu = actionEl && ['menu', 'editor', 'terminal', 'ports'].includes(actionEl.dataset.action);
  if (!inMenu && !opensMenu) closeMenu();
  if (!actionEl) return;
  const id = inMenu ? $('menu').dataset.id : actionEl.closest('.card')?.dataset.id;
  const p = id && byId(id);
  if (p) handleAction(actionEl.dataset.action, p, actionEl);
});

$('query').addEventListener('input', (e) => {
  state.query = e.target.value.trim();
  render();
});

$('query').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = document.querySelector('.grid .card a.thumb, .grid .card a.port');
    if (first) location.href = first.href;
  }
});

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input, textarea');
  if (e.key === 'Escape') {
    if (!$('menu').hidden) return closeMenu();
    if (state.editing) {
      state.editing = null;
      return render();
    }
    if (e.target === $('query')) {
      e.target.value = '';
      state.query = '';
      e.target.blur();
      return render();
    }
  }
  if (e.key === 'Enter' && e.target.matches('[data-role="command"]')) {
    const p = byId(e.target.closest('.card').dataset.id);
    if (p) saveCommand(p);
  }
  if (e.key === '/' && !typing && !$('search').hidden) {
    e.preventDefault();
    $('query').focus();
  }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !$('menu').hidden) {
    e.preventDefault();
    const items = [...$('menu').querySelectorAll('.menu-item')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
});

/* Tooltips: short delay when cold, instant while moving between neighbours */

const tip = { el: null, target: null, timer: null, warmUntil: 0 };

function placeTip(target) {
  const el = $('tooltip');
  el.textContent = target.dataset.tip;
  el.hidden = false;
  const r = target.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  const above = r.top - t.height - 8 >= 8;
  el.style.top = `${above ? r.top - t.height - 8 : r.bottom + 8}px`;
  el.style.left = `${Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2))}px`;
  el.dataset.side = above ? 'top' : 'bottom';
  el.classList.add('is-visible');
}

function showTip(target, immediate) {
  clearTimeout(tip.timer);
  tip.target = target;
  const warm = Date.now() < tip.warmUntil;
  if (immediate || warm) placeTip(target);
  else tip.timer = setTimeout(() => tip.target === target && target.isConnected && placeTip(target), 150);
}

function hideTip() {
  clearTimeout(tip.timer);
  const el = $('tooltip');
  if (el.classList.contains('is-visible')) tip.warmUntil = Date.now() + 800;
  el.classList.remove('is-visible');
  tip.target = null;
}

document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const target = e.target.closest('[data-tip]');
  if (target === tip.target) return;
  if (target && !state.menuFor) showTip(target, false);
  else hideTip();
});

document.addEventListener('pointerdown', hideTip);
document.addEventListener('focusin', (e) => {
  const target = e.target.closest('[data-tip]');
  if (target && e.target.matches(':focus-visible')) showTip(target, true);
});
document.addEventListener('focusout', hideTip);
window.addEventListener('scroll', hideTip, { passive: true });

window.addEventListener('resize', () => closeMenu(true));
window.addEventListener('scroll', () => closeMenu(true), { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(pollTimer);
  else refresh();
});

$('copy-setup').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('setup-command').textContent);
  toast('Copied. Paste it in Terminal.');
});

$('retry-setup').addEventListener('click', () => location.reload());

function applyTheme(choice) {
  if (choice === 'light' || choice === 'dark') document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  for (const btn of document.querySelectorAll('.theme-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === choice));
}

applyTheme(document.documentElement.dataset.theme || 'auto');

for (const btn of document.querySelectorAll('.theme-btn')) {
  btn.addEventListener('click', () => {
    const choice = btn.dataset.themeChoice;
    applyTheme(choice);
    try {
      localStorage.setItem('theme', choice);
    } catch {}
  });
}

for (const btn of document.querySelectorAll('.view-btn')) {
  btn.addEventListener('click', async () => {
    if (state.view === btn.dataset.view) return;
    state.view = btn.dataset.view;
    render();
    const prefs = { ...(state.media.prefs || {}), view: state.view };
    state.media.prefs = prefs;
    await chrome.storage?.local.set({ prefs });
  });
}

if (chrome.storage) {
  chrome.storage.local.get(null, (items) => {
    state.media = items || {};
    state.view = state.media.prefs?.view === 'list' ? 'list' : 'grid';
    refresh();
  });
} else {
  refresh();
}
