import { $, icon, esc, ago, toast, state } from './core.js';
import { openPopover, closeMenu, menuItem } from './menu.js';
import { normalizePrefs, isSectionOn } from './lib/prefs.js';

const HOST = 'com.arcadie.localhost_newtab';
const POLL_MS = 3000;
const FAST_POLL_MS = 1000;
const THUMB_STALE_MS = 30 * 60 * 1000;
const THUMB_SETTLE_MS = 5000;

const PLATFORM = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
const FOLDER_LABEL = /win/i.test(PLATFORM) ? 'Show in File Explorer' : /mac/i.test(PLATFORM) ? 'Show in Finder' : 'Open folder';

const cardCache = new WeakMap();
let pollTimer = null;

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

export function matches(p) {
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

const PROJECT_SECTIONS = ['pinned', 'running', 'services', 'recent'];

export function syncTools() {
  const count = state.projects.length;
  $('search').hidden = state.tab === 'projects' && (state.setup || count < 2);
  $('view-toggle').hidden = state.setup || !count;
}

export function render() {
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

  state.setup = false;
  syncTools();
  $('app').dataset.view = state.view;
  for (const btn of document.querySelectorAll('.view-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.view === state.view));
  $('setup').hidden = true;

  const prefs = normalizePrefs(state.media.prefs);
  const shown = (id, list) => (isSectionOn(prefs, id) ? list.filter(matches) : []);
  const pinnedShown = shown('pinned', pinned);
  const servicesShown = shown('services', services);
  const runningShown = shown('running', running);
  const recentShown = shown('recent', recent);
  const anyOff = PROJECT_SECTIONS.some((id) => !isSectionOn(prefs, id));

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
      $('empty-text').textContent = state.query ? `Nothing matches “${state.query}”.` : anyOff ? 'All sections are hidden.' : '';
      $('empty-settings').hidden = Boolean(state.query) || !anyOff;
    }
  };

  const layout = [pinnedShown, runningShown, servicesShown, recentShown].map((list) => list.map((p) => p.id).join(',')).join('|');
  const animate = state.tab === 'projects' && state.loaded && layout !== state.layout && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
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

export function renderSetup(err) {
  $('headline').textContent = 'Connect the helper.';
  $('lede').textContent = 'One command, once.';
  state.setup = true;
  syncTools();
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

export async function refresh() {
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

export function byId(id) {
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

function showMenu(p, trigger, kind, html) {
  openPopover(trigger, html, {
    id: p.id,
    kind,
    onAction: (action, el) => {
      const q = byId(p.id);
      if (q) handleAction(action, q, el);
    },
  });
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

/* Events */

document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  const inMenu = e.composedPath().includes($('menu'));
  const opensMenu = actionEl && ['menu', 'editor', 'terminal', 'ports'].includes(actionEl.dataset.action);
  if (!inMenu && !opensMenu && !state.menuTrigger?.contains(e.target)) closeMenu();
  if (!actionEl || inMenu) return;
  const id = actionEl.closest('.card')?.dataset.id;
  const p = id && byId(id);
  if (p) handleAction(actionEl.dataset.action, p, actionEl);
});

$('query').addEventListener('input', (e) => {
  if (state.tab !== 'projects') return;
  state.query = e.target.value.trim();
  render();
});

$('query').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state.tab === 'projects') {
    const first = document.querySelector('.grid .card a.thumb, .grid .card a.port');
    if (first) location.href = first.href;
  }
});

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input, textarea');
  if (e.key === 'Escape') {
    if (state.editing) {
      state.editing = null;
      return render();
    }
    if (e.target === $('query')) {
      e.target.value = '';
      e.target.dispatchEvent(new Event('input'));
      e.target.blur();
      return;
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
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(pollTimer);
  else refresh();
});

$('copy-setup').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('setup-command').textContent);
  toast('Copied. Paste it in Terminal.');
});

$('retry-setup').addEventListener('click', () => location.reload());

export function startProjects() {
  refresh();
}
