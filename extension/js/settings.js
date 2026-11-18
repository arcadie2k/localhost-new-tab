import { $, state } from './core.js';
import { closeMenu } from './menu.js';
import { normalizePrefs, needsBadge } from './lib/prefs.js';
import { FEATURE_PERMISSION, grantedMap, onPermissionsChange, requestPermission } from './permissions.js';

let changed = () => {};

export function prefs() {
  return normalizePrefs(state.media.prefs);
}

export function featureOn(id) {
  const perm = FEATURE_PERMISSION[id];
  return prefs().sections[id] && (!perm || Boolean(state.granted && state.granted[perm]));
}

export async function refreshPermissions() {
  state.granted = await grantedMap();
  $('settings-badge').hidden = !needsBadge(state.granted);
  syncSettings();
}

export async function savePrefs(patch) {
  const current = prefs();
  const next = { ...current, ...patch, sections: { ...current.sections, ...(patch.sections || {}) } };
  state.media.prefs = next;
  await chrome.storage?.local.set({ prefs: next });
  return next;
}

export function applyTheme(choice) {
  if (choice === 'light' || choice === 'dark') document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  for (const btn of document.querySelectorAll('.theme-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === choice));
}

export function syncSettings() {
  const p = prefs();
  for (const input of $('settings').querySelectorAll('[data-section]')) input.checked = featureOn(input.dataset.section);
  $('unhide-sites').hidden = !p.hiddenSites.length;
}

function place() {
  const panel = $('settings');
  const r = $('settings-btn').getBoundingClientRect();
  const w = panel.getBoundingClientRect().width;
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.left = `${Math.min(window.innerWidth - w - 16, Math.max(16, r.right - w))}px`;
}

export function openSettings() {
  closeMenu(true);
  syncSettings();
  const panel = $('settings');
  panel.hidden = false;
  place();
  $('settings-btn').setAttribute('aria-expanded', 'true');
  panel.querySelector('[aria-pressed="true"], input')?.focus({ preventScroll: true });
}

export function closeSettings({ restoreFocus = false } = {}) {
  if ($('settings').hidden) return;
  $('settings').hidden = true;
  $('settings-btn').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('settings-btn').focus();
}

export async function setSection(id, on) {
  const next = await savePrefs({ sections: { [id]: on } });
  syncSettings();
  changed(next);
}

function askPermission(id) {
  const perm = FEATURE_PERMISSION[id];
  return perm ? requestPermission(perm) : Promise.resolve(true);
}

export function initSettings({ onChange }) {
  changed = onChange;
  onPermissionsChange(async () => {
    await refreshPermissions();
    changed(prefs());
  });
  applyTheme(document.documentElement.dataset.theme || 'auto');

  $('settings-btn').addEventListener('click', () => ($('settings').hidden ? openSettings() : closeSettings()));

  for (const btn of document.querySelectorAll('.theme-btn')) {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      applyTheme(choice);
      try {
        localStorage.setItem('theme', choice);
      } catch {}
    });
  }

  for (const input of $('settings').querySelectorAll('[data-section]')) {
    input.addEventListener('change', async () => {
      const id = input.dataset.section;
      const on = input.checked;
      if (on) {
        const ok = await askPermission(id);
        if (!ok) {
          input.checked = false;
          return;
        }
        state.granted = { ...state.granted, [FEATURE_PERMISSION[id]]: true };
      }
      await setSection(id, on);
      if (on) refreshPermissions();
    });
  }

  $('unhide-sites').addEventListener('click', async () => {
    const next = await savePrefs({ hiddenSites: [] });
    syncSettings();
    changed(next);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#settings, #settings-btn')) closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('settings').hidden) closeSettings({ restoreFocus: true });
  });
  window.addEventListener('resize', () => closeSettings());
}
