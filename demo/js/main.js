import { $, state, toast } from './core.js';
import { render, startProjects, syncTools } from './projects.js';
import { renderMostVisited } from './most-visited.js';
import { renderBookmarks } from './bookmarks.js';
import { featureOn, initSettings, openSettings, prefs, refreshPermissions, savePrefs } from './settings.js';

window.toast = toast;

export function setTab(tab) {
  const next = tab === 'bookmarks' && featureOn('bookmarks') ? 'bookmarks' : 'projects';
  const changed = state.tab !== next;
  state.tab = next;
  $('app').dataset.tab = next;
  for (const btn of document.querySelectorAll('.tab-btn')) {
    const on = btn.dataset.tab === next;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  }
  $('query').placeholder = next === 'bookmarks' ? 'Search bookmarks' : 'Search projects';
  $('query').setAttribute('aria-label', $('query').placeholder);
  if (changed) {
    $('query').value = '';
    state.query = '';
    closeSearch();
    if (state.loaded) render();
  }
  syncTools();
  if (changed) renderBookmarks();
}

function syncChrome() {
  $('tab-switch').hidden = !featureOn('bookmarks');
  renderMostVisited();
  if (state.tab === 'bookmarks' && !featureOn('bookmarks')) setTab('projects');
  else renderBookmarks();
}

function openSearch() {
  $('search').classList.add('is-open');
}

function closeSearch() {
  if (document.activeElement === $('query')) return;
  if ($('query').value) return;
  $('search').classList.remove('is-open');
}

$('query').addEventListener('focus', openSearch);
$('query').addEventListener('blur', () => setTimeout(closeSearch, 0));

for (const btn of document.querySelectorAll('.tab-btn')) {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
}

$('tab-switch').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const next = state.tab === 'projects' ? 'bookmarks' : 'projects';
  setTab(next);
  document.querySelector(`.tab-btn[data-tab="${state.tab}"]`).focus();
});

for (const btn of document.querySelectorAll('.view-btn')) {
  btn.addEventListener('click', async () => {
    if (state.view === btn.dataset.view) return;
    state.view = btn.dataset.view;
    render();
    await savePrefs({ view: state.view });
  });
}

$('empty-settings').addEventListener('click', (e) => {
  e.stopPropagation();
  openSettings();
});

initSettings({
  onChange: () => {
    if (state.loaded) render();
    syncChrome();
  },
});

async function boot() {
  state.view = prefs().view;
  await refreshPermissions();
  setTab('projects');
  syncChrome();
  startProjects();
}

if (chrome.storage) {
  chrome.storage.local.get(null, (items) => {
    state.media = items || {};
    boot();
  });
} else {
  boot();
}
