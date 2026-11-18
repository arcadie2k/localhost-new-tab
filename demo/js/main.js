import { state, toast } from './core.js';
import { render, startProjects } from './projects.js';

window.toast = toast;

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
    startProjects();
  });
} else {
  startProjects();
}
