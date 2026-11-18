import { $, state, toast } from './core.js';
import { render, startProjects, syncTools } from './projects.js';
import { initSettings, openSettings, prefs, savePrefs } from './settings.js';

window.toast = toast;

const tabHooks = [];

export function onTabChange(fn) {
  tabHooks.push(fn);
}

export function setTab(tab) {
  const next = tab === 'bookmarks' && prefs().sections.bookmarks ? 'bookmarks' : 'projects';
  const changed = state.tab !== next;
  state.tab = next;
  $('app').dataset.tab = next;
  for (const btn of document.querySelectorAll('.tab-btn')) btn.setAttribute('aria-selected', String(btn.dataset.tab === next));
  $('query').placeholder = next === 'bookmarks' ? 'Search bookmarks' : 'Search projects';
  $('query').setAttribute('aria-label', $('query').placeholder);
  if (changed) {
    $('query').value = '';
    state.query = '';
    closeSearch();
    if (state.loaded) render();
  }
  syncTools();
  for (const fn of tabHooks) fn(next);
}

function syncChrome() {
  $('tab-switch').hidden = !prefs().sections.bookmarks;
  if (state.tab === 'bookmarks' && !prefs().sections.bookmarks) setTab('projects');
  else for (const fn of tabHooks) fn(state.tab);
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

function boot() {
  state.view = prefs().view;
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
