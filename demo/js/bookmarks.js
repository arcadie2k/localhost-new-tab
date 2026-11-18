import { $, esc, icon, state, faviconHTML } from './core.js';
import { featureOn } from './settings.js';
import { columnsFor, displayTitle, isBookmarklet } from './lib/bookmark-tree.js';

const view = {
  tree: null,
  path: [],
  query: '',
  listening: false,
  reloadTimer: null,
  focusAfter: null,
};

function api() {
  return chrome.bookmarks;
}

function indexTree(root) {
  const map = new Map();
  const walk = (n) => {
    map.set(n.id, n);
    (n.children || []).forEach(walk);
  };
  walk(root);
  return map;
}

function rowHTML(node, colIndex, index, extra = '') {
  const selected = view.path[colIndex] === node.id;
  const attrs = `data-id="${esc(node.id)}" data-col="${colIndex}" data-index="${index}"`;
  const title = esc(displayTitle(node));
  if (!node.url) {
    return `<li><button class="bm-row is-folder${selected ? ' is-selected' : ''}" ${attrs} aria-expanded="${selected}">${icon('folder', 'bm-folder')}<span class="bm-title">${title}</span>${extra}${icon('chevron', 'bm-chevron')}</button></li>`;
  }
  if (isBookmarklet(node)) {
    return `<li><div class="bm-row is-disabled" tabindex="0" ${attrs} data-tip="Bookmarklets only run from Chrome's bookmarks bar">${icon('code', 'bm-folder')}<span class="bm-title">${title}</span>${extra}</div></li>`;
  }
  return `<li><a class="bm-row" href="${esc(node.url)}" ${attrs} data-tip="${esc(node.url)}">${faviconHTML(node.url, displayTitle(node), 'fav-sm')}<span class="bm-title">${title}</span>${extra}</a></li>`;
}

function renderColumns() {
  const cols = columnsFor(view.tree, view.path);
  view.path = cols.slice(1).map((c) => c.folder.id);
  $('bm-columns').innerHTML = cols
    .map((col, i) => {
      const rows = col.children.map((n, j) => rowHTML(n, i, j)).join('');
      const empty = col.children.length ? '' : '<li class="bm-col-empty">Empty folder</li>';
      return `<ul class="bm-col" data-folder="${esc(col.folder.id)}" data-col="${i}" aria-label="${esc(displayTitle(col.folder) === 'Untitled' ? 'Bookmarks' : displayTitle(col.folder))}">${rows}${empty}</ul>`;
    })
    .join('');
  $('bm-crumbs').innerHTML = cols
    .slice(1)
    .map((c, i) => `<button class="bm-crumb" data-depth="${i + 1}">${esc(displayTitle(c.folder))}</button>`)
    .join(`<span class="bm-crumb-sep" aria-hidden="true">${icon('chevron')}</span>`) || '<span class="bm-crumb is-root">Bookmarks</span>';
  const box = $('bm-columns');
  box.scrollLeft = box.scrollWidth;
  if (view.focusAfter) {
    box.querySelector(view.focusAfter)?.focus({ preventScroll: true });
    view.focusAfter = null;
  }
}

async function renderResults() {
  let found = [];
  try {
    found = (await api().search(view.query)).filter((n) => n.url);
  } catch {}
  const map = indexTree(view.tree);
  $('bm-results').innerHTML = found
    .map((n, i) => {
      const parent = map.get(n.parentId);
      const where = parent ? `<span class="bm-where">${esc(displayTitle(parent))}</span>` : '';
      return rowHTML(n, -1, i, where);
    })
    .join('');
  $('bm-results').hidden = !found.length;
  $('bm-empty').hidden = Boolean(found.length);
  $('bm-empty').textContent = found.length ? '' : `No bookmarks match “${view.query}”.`;
}

export async function renderBookmarks() {
  if (state.tab !== 'bookmarks' || !featureOn('bookmarks') || !api()) return;
  listen();
  view.query = $('query').value.trim();
  try {
    [view.tree] = await api().getTree();
  } catch {
    return;
  }
  const searching = Boolean(view.query);
  $('bm-columns').hidden = searching;
  $('bm-crumbs').hidden = searching;
  if (searching) return renderResults();
  $('bm-results').hidden = true;
  $('bm-empty').hidden = true;
  renderColumns();
}

function scheduleReload() {
  clearTimeout(view.reloadTimer);
  view.reloadTimer = setTimeout(renderBookmarks, 50);
}

function listen() {
  if (view.listening) return;
  view.listening = true;
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered']) api()[ev]?.addListener(scheduleReload);
}

function openFolder(id, col) {
  view.path = [...view.path.slice(0, col), id];
  renderColumns();
}

$('bm-columns').addEventListener('click', (e) => {
  const row = e.target.closest('.bm-row.is-folder');
  if (row) openFolder(row.dataset.id, Number(row.dataset.col));
});

$('bm-crumbs').addEventListener('click', (e) => {
  const crumb = e.target.closest('.bm-crumb[data-depth]');
  if (!crumb) return;
  view.path = view.path.slice(0, Number(crumb.dataset.depth));
  renderColumns();
});

$('bm-columns').addEventListener('keydown', (e) => {
  const row = e.target.closest('.bm-row');
  if (!row) return;
  const col = Number(row.dataset.col);
  const rows = [...row.closest('.bm-col').querySelectorAll('.bm-row')];
  const i = rows.indexOf(row);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  } else if (e.key === 'ArrowRight' && row.classList.contains('is-folder')) {
    e.preventDefault();
    const id = row.dataset.id;
    openFolder(id, col);
    const box = $('bm-columns');
    (box.querySelector(`.bm-col[data-col="${col + 1}"] .bm-row`) || box.querySelector(`.bm-row[data-id="${CSS.escape(id)}"]`))?.focus();
  } else if (e.key === 'ArrowLeft' && col > 0) {
    e.preventDefault();
    const parentId = view.path[col - 1];
    view.path = view.path.slice(0, col);
    view.focusAfter = `.bm-col[data-col="${col - 1}"] .bm-row[data-id="${CSS.escape(parentId)}"]`;
    renderColumns();
  }
});

$('query').addEventListener('input', () => {
  if (state.tab === 'bookmarks') renderBookmarks();
});

export function resetBookmarks() {
  view.path = [];
  view.query = '';
}

export { view as bookmarksView };
