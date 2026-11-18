export const ICONS = {
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
  hide: '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  folderPlus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
};

export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export const $ = (id) => document.getElementById(id);

export const state = {
  tab: 'projects',
  setup: false,
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

let toastTimer = null;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function toast(msg, { action } = {}) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('has-action', Boolean(action));
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      el.classList.remove('is-visible');
      action.run();
    });
    el.append(' ', btn);
  }
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), action ? 6000 : 3600);
}

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

export function hideTip() {
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

export function faviconURL(pageUrl, size = 32) {
  const base = chrome.runtime?.getURL ? chrome.runtime.getURL('/_favicon/') : '/_favicon/';
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

export function faviconHTML(url, label, cls = '') {
  const letter = esc((label || '?').trim()[0]?.toUpperCase() || '?');
  return `<span class="fav ${cls}" data-letter="${letter}"><img src="${esc(faviconURL(url))}" alt="" loading="lazy" draggable="false"></span>`;
}

document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.parentElement?.classList.contains('fav')) return;
    const box = img.parentElement;
    box.classList.add('is-letter');
    box.textContent = box.dataset.letter;
  },
  true
);
