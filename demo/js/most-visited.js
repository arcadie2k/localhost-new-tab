import { $, esc, icon, state } from './core.js';
import { faviconHTML } from './core.js';
import { openPopover, closeMenu } from './menu.js';
import { featureOn, prefs, savePrefs, syncSettings } from './settings.js';
import { pickTopSites } from './lib/top-sites.js';

let renderToken = 0;

function chipHTML(site) {
  return `<a class="site-chip" href="${esc(site.url)}" data-url="${esc(site.url)}" data-tip="${esc(site.title)} · ${esc(site.url)}">${faviconHTML(site.url, site.title)}<span class="site-name">${esc(site.title)}</span></a>`;
}

export async function renderMostVisited() {
  const el = $('most-visited');
  const token = ++renderToken;
  if (state.tab !== 'projects' || !featureOn('mostVisited')) {
    el.hidden = true;
    return;
  }
  let sites = [];
  try {
    sites = pickTopSites(await chrome.topSites.get(), prefs().hiddenSites);
  } catch {}
  if (token !== renderToken) return;
  el.innerHTML = sites.map(chipHTML).join('');
  el.hidden = !sites.length;
  fitChips();
}

function fitChips() {
  const el = $('most-visited');
  if (el.hidden) return;
  const right = el.getBoundingClientRect().right;
  for (const chip of el.children) {
    chip.style.visibility = '';
    if (chip.getBoundingClientRect().right > right + 1) chip.style.visibility = 'hidden';
  }
}

window.addEventListener('resize', fitChips);

async function hideSite(url) {
  closeMenu();
  const hidden = prefs().hiddenSites;
  if (!hidden.includes(url)) await savePrefs({ hiddenSites: [...hidden, url] });
  syncSettings();
  renderMostVisited();
}

function openChipMenu(chip) {
  const url = chip.dataset.url;
  openPopover(chip, `<button class="menu-item" role="menuitem" data-action="hide-site">${icon('hide')}<span>Hide</span></button>`, {
    id: url,
    kind: 'site',
    onAction: (action) => action === 'hide-site' && hideSite(url),
  });
}

$('most-visited').addEventListener('contextmenu', (e) => {
  const chip = e.target.closest('.site-chip');
  if (!chip) return;
  e.preventDefault();
  openChipMenu(chip);
});

$('most-visited').addEventListener('keydown', (e) => {
  const chip = e.target.closest('.site-chip');
  if (!chip || !((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu' || e.key === 'Delete' || e.key === 'Backspace')) return;
  e.preventDefault();
  openChipMenu(chip);
});
