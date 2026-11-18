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
  spinner: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
};

export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export const $ = (id) => document.getElementById(id);

export const state = {
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

export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3600);
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
