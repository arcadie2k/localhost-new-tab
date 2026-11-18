import { $, esc, icon, faviconHTML } from './core.js';
import { openPopover, closeMenu } from './menu.js';
import { featureOn, prefs, savePrefs, syncSettings } from './settings.js';
import { pickTopSites } from './lib/top-sites.js';

let renderToken = 0;

function chipHTML(site) {
  return `<a class="site-chip" href="${esc(site.url)}" data-url="${esc(site.url)}">${faviconHTML(site.url, site.title)}<span class="site-name">${esc(site.title)}</span></a>`;
}

export async function renderMostVisited() {
  const el = $('most-visited');
  const token = ++renderToken;
  if (!featureOn('mostVisited')) {
    el.hidden = true;
    return;
  }
  let sites = [];
  try {
    sites = pickTopSites(await chrome.topSites.get(), prefs().hiddenSites);
  } catch {}
  if (token !== renderToken) return;
  el.innerHTML = sites.map(chipHTML).join('') + '<button class="site-chip site-more" type="button" aria-expanded="false" hidden></button>';
  el.hidden = !sites.length;
  fitChips();
}

function fitChips() {
  const el = $('most-visited');
  if (el.hidden) return;
  const more = el.querySelector('.site-more');
  const chips = [...el.querySelectorAll('.site-chip:not(.site-more)')];
  const expanded = prefs().sitesExpanded;
  el.classList.remove('is-expanded');
  for (const chip of chips) chip.hidden = false;
  more.hidden = true;
  const right = el.getBoundingClientRect().right + 1;
  const overflows = () => chips.some((c) => !c.hidden && c.getBoundingClientRect().right > right);
  if (!overflows()) return;
  more.hidden = false;
  more.setAttribute('aria-expanded', String(expanded));
  if (expanded) {
    el.classList.add('is-expanded');
    more.textContent = 'Show less';
    more.removeAttribute('aria-label');
    return;
  }
  let hiddenCount = 0;
  for (let i = chips.length - 1; i > 0; i--) {
    more.textContent = `+${hiddenCount}`;
    if (!overflows() && more.getBoundingClientRect().right <= right) break;
    chips[i].hidden = true;
    hiddenCount++;
  }
  more.textContent = `+${hiddenCount}`;
  more.setAttribute('aria-label', `Show ${hiddenCount} more sites`);
}

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
let busy = false;

function slideBoard(delta) {
  const board = document.querySelector('.board');
  if (!board || !delta) return;
  board.getAnimations().forEach((a) => a.cancel());
  board.animate({ transform: [`translateY(${-delta}px)`, 'translateY(0)'] }, { duration: 320, easing: EASE });
}

$('most-visited').addEventListener('click', async (e) => {
  if (!e.target.closest('.site-more') || busy) return;
  const el = $('most-visited');
  const expanding = !prefs().sitesExpanded;
  const from = el.offsetHeight;
  const firstTop = el.firstElementChild.offsetTop;
  busy = true;
  try {
    if (!expanding && !calm()) {
      const extra = [...el.children].filter((c) => !c.hidden && (c.offsetTop > firstTop || c.classList.contains('site-more')));
      const fades = extra.reverse().map((c, i) => c.animate({ opacity: [1, 0] }, { duration: 140, delay: i * 15, easing: 'ease-in', fill: 'forwards' }).finished);
      await Promise.race([Promise.all(fades), new Promise((r) => setTimeout(r, 400))]);
    }
    const wasHidden = new Set(el.querySelectorAll('.site-chip[hidden]'));
    await savePrefs({ sitesExpanded: expanding });
    fitChips();
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    el.querySelector('.site-more')?.focus({ preventScroll: true });
    if (calm()) return;
    slideBoard(el.offsetHeight - from);
    if (expanding) {
      const shown = [...el.querySelectorAll('.site-chip')].filter((c) => (wasHidden.has(c) || c.classList.contains('site-more')) && !c.hidden);
      shown.forEach((c, i) => c.animate({ opacity: [0, 1], transform: ['translateY(-4px)', 'none'] }, { duration: 240, delay: 40 + i * 20, easing: EASE, fill: 'backwards' }));
    }
  } finally {
    busy = false;
  }
});

let fitFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(fitChips);
});

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
