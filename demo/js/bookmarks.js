import { $, esc, icon, state, toast, faviconHTML } from './core.js';
import { featureOn } from './settings.js';
import { openPopover, closeMenu, menuItem } from './menu.js';
import { canDrop, columnsFor, countBookmarks, displayTitle, isBookmarklet, isFixedNode, normalizeUrl, restoreTree } from './lib/bookmark-tree.js';

const view = {
  tree: null,
  path: [],
  query: '',
  listening: false,
  reloadTimer: null,
  focusAfter: null,
  editing: null,
  nodes: new Map(),
};

const BAR_ID = '1';

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

function editorHTML(node, { isNew = false, parentId = '' } = {}) {
  const hasUrl = isNew || node.url !== undefined;
  const title = isNew ? '' : node.title || '';
  return `<li class="bm-item is-editing"><form class="bm-edit" data-id="${esc(isNew ? '' : node.id)}" data-parent="${esc(parentId)}" data-new="${isNew}">
    <input class="bm-input" name="title" value="${esc(title)}" placeholder="${hasUrl ? 'Name' : 'Folder name'}" aria-label="Name" autocomplete="off" spellcheck="false">
    ${hasUrl ? `<input class="bm-input" name="url" value="${esc(isNew ? '' : node.url)}" placeholder="https://" aria-label="URL" autocomplete="off" spellcheck="false">` : ''}
    <div class="bm-edit-actions"><button class="chip-btn is-primary" type="submit">Save</button><button class="chip-btn" type="button" data-bm-action="cancel-edit">Cancel</button></div>
  </form></li>`;
}

function rowHTML(node, colIndex, index, extra = '') {
  if (view.editing === node.id) return editorHTML(node);
  const more = isFixedNode(node) ? '' : `<button class="bm-more" data-bm-action="menu" data-id="${esc(node.id)}" aria-label="Actions for ${esc(displayTitle(node))}" aria-haspopup="menu">${icon('more')}</button>`;
  return `<li class="bm-item" data-id="${esc(node.id)}">${rowInner(node, colIndex, index, extra)}${more}</li>`;
}

function rowInner(node, colIndex, index, extra) {
  const selected = view.path[colIndex] === node.id;
  const drag = colIndex >= 0 && !isFixedNode(node) ? ' draggable="true"' : ' draggable="false"';
  const attrs = `data-id="${esc(node.id)}" data-col="${colIndex}" data-index="${index}"${drag}`;
  const title = esc(displayTitle(node));
  if (!node.url) {
    return `<button class="bm-row is-folder${selected ? ' is-selected' : ''}" ${attrs} aria-expanded="${selected}">${icon('folder', 'bm-folder')}<span class="bm-title">${title}</span>${extra}${icon('chevron', 'bm-chevron')}</button>`;
  }
  if (isBookmarklet(node)) {
    return `<div class="bm-row is-disabled" tabindex="0" ${attrs} data-tip="Bookmarklets only run from Chrome's bookmarks bar">${icon('code', 'bm-folder')}<span class="bm-title">${title}</span>${extra}</div>`;
  }
  return `<a class="bm-row" href="${esc(node.url)}" ${attrs} data-tip="${esc(node.url)}">${faviconHTML(node.url, displayTitle(node), 'fav-sm')}<span class="bm-title">${title}</span>${extra}</a>`;
}

function renderColumns() {
  const cols = columnsFor(view.tree, view.path);
  view.path = cols.slice(1).map((c) => c.folder.id);
  $('bm-columns').innerHTML = cols
    .map((col, i) => {
      const draft = view.editing === `new:${col.folder.id}` ? editorHTML(null, { isNew: true, parentId: col.folder.id }) : '';
      const rows = col.children.map((n, j) => rowHTML(n, i, j)).join('') + draft;
      const empty = rows ? '' : '<li class="bm-col-empty">Empty folder</li>';
      return `<ul class="bm-col" data-folder="${esc(col.folder.id)}" data-col="${i}" aria-label="${esc(displayTitle(col.folder) === 'Untitled' ? 'Bookmarks' : displayTitle(col.folder))}">${rows}${empty}</ul>`;
    })
    .join('');
  $('bm-crumbs').innerHTML = cols
    .slice(1)
    .map((c, i) => `<button class="bm-crumb" data-depth="${i + 1}">${esc(displayTitle(c.folder))}</button>`)
    .join(`<span class="bm-crumb-sep" aria-hidden="true">${icon('chevron')}</span>`) || '<span class="bm-crumb is-root">Bookmarks</span>';
  const box = $('bm-columns');
  box.scrollLeft = box.scrollWidth;
  const input = box.querySelector('.bm-edit .bm-input');
  if (input) {
    input.focus({ preventScroll: true });
    input.select();
  }
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
  view.nodes = indexTree(view.tree);
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

function targetFolder() {
  if (!view.path.length) view.path = [BAR_ID];
  return view.path[view.path.length - 1];
}

async function newFolder(parentId) {
  closeMenu();
  try {
    const node = await api().create({ parentId, title: 'New folder' });
    view.editing = node.id;
  } catch (e) {
    toast(e.message);
  }
  renderBookmarks();
}

function newBookmark(parentId) {
  closeMenu();
  view.editing = `new:${parentId}`;
  renderColumns();
}

async function saveEdit(form) {
  const title = form.elements.title.value.trim();
  const urlField = form.elements.url;
  let url;
  if (urlField) {
    url = normalizeUrl(urlField.value);
    if (!url) {
      urlField.setCustomValidity('Enter a valid URL');
      urlField.reportValidity();
      urlField.addEventListener('input', () => urlField.setCustomValidity(''), { once: true });
      return;
    }
  }
  try {
    if (form.dataset.new === 'true') {
      await api().create({ parentId: form.dataset.parent, title: title || (url && new URL(url).hostname) || '', url });
    } else {
      const changes = { title };
      if (urlField) changes.url = url;
      await api().update(form.dataset.id, changes);
    }
  } catch (e) {
    toast(e.message);
  }
  view.editing = null;
  renderBookmarks();
}

function cancelEdit() {
  view.editing = null;
  renderColumns();
}

async function removeNode(node) {
  closeMenu();
  let snapshot;
  try {
    [snapshot] = await api().getSubTree(node.id);
    if (snapshot.url !== undefined || !snapshot.children?.length) await api().remove(node.id);
    else await api().removeTree(node.id);
  } catch (e) {
    toast(e.message);
    return;
  }
  const name = displayTitle(snapshot);
  if (snapshot.url !== undefined || !snapshot.children?.length) {
    toast(`Deleted “${name}”`, {
      action: { label: 'Undo', run: () => restoreTree(api(), snapshot, snapshot.parentId, snapshot.index).catch((e) => toast(e.message)) },
    });
  } else {
    toast(`Deleted “${name}”`);
  }
}

function confirmDelete(node, trigger) {
  const n = countBookmarks(node);
  const what = n ? `and its ${n} ${n === 1 ? 'bookmark' : 'bookmarks'}` : 'and everything in it';
  openPopover(
    trigger,
    `<div class="menu-label menu-confirm">Delete “${esc(displayTitle(node))}” ${what}? This can't be undone.</div>
    <button class="menu-item is-danger" role="menuitem" data-action="confirm-delete">${icon('trash')}<span>Delete</span></button>
    <button class="menu-item" role="menuitem" data-action="cancel">${icon('back')}<span>Cancel</span></button>`,
    { id: node.id, kind: 'bm-confirm', onAction: (action) => (action === 'confirm-delete' ? removeNode(node) : closeMenu()) }
  );
}

function openRowMenu(node, trigger) {
  if (state.menuFor === node.id && state.menuKind === 'bm') return closeMenu();
  const items = [
    node.url !== undefined ? menuItem('edit', 'edit', 'Edit') : menuItem('rename', 'edit', 'Rename'),
    menuItem('new-folder-here', 'folderPlus', 'New folder here'),
    '<div class="menu-sep" role="separator"></div>',
    menuItem('delete', 'trash', 'Delete'),
  ];
  openPopover(trigger, items.join(''), {
    id: node.id,
    kind: 'bm',
    onAction: (action) => {
      if (action === 'edit' || action === 'rename') {
        closeMenu();
        view.editing = node.id;
        return renderColumns();
      }
      if (action === 'new-folder-here') return newFolder(node.parentId);
      if (action === 'delete') {
        if (node.url === undefined && node.children?.length) return confirmDelete(node, trigger);
        return removeNode(node);
      }
    },
  });
}

$('bookmarks-view').addEventListener('click', (e) => {
  const el = e.target.closest('[data-bm-action]');
  if (!el) return;
  const action = el.dataset.bmAction;
  if (action === 'new-folder') newFolder(targetFolder());
  else if (action === 'new-bookmark') newBookmark(targetFolder());
  else if (action === 'cancel-edit') cancelEdit();
  else if (action === 'menu') {
    const node = view.nodes.get(el.dataset.id);
    if (node) openRowMenu(node, el);
  }
});

$('bookmarks-view').addEventListener('contextmenu', (e) => {
  const item = e.target.closest('.bm-item[data-id]');
  const node = item && view.nodes.get(item.dataset.id);
  if (!node || isFixedNode(node)) return;
  e.preventDefault();
  openRowMenu(node, item.querySelector('.bm-more') || item);
});

$('bookmarks-view').addEventListener('submit', (e) => {
  e.preventDefault();
  saveEdit(e.target);
});

$('bookmarks-view').addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.target.closest('.bm-edit')) {
    e.stopPropagation();
    cancelEdit();
  }
});

const drag = { id: null, hoverId: null, hoverTimer: null };

function clearDropMarks() {
  document.querySelectorAll('.drop-before, .drop-after, .drop-into, .drop-end').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into', 'drop-end'));
}

function dropTarget(e) {
  const item = e.target.closest('.bm-item[data-id]');
  const col = e.target.closest('.bm-col');
  if (!col) return null;
  const folderId = col.dataset.folder;
  if (!item) {
    const count = col.querySelectorAll(':scope > .bm-item[data-id]').length;
    return { parentId: folderId, index: count, mark: col, cls: 'drop-end' };
  }
  const node = view.nodes.get(item.dataset.id);
  const index = Number(item.querySelector('.bm-row')?.dataset.index ?? 0);
  const r = item.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  if (node && !node.url && y > 0.25 && y < 0.75) return { parentId: node.id, index: undefined, mark: item, cls: 'drop-into', folder: node };
  return y < 0.5 ? { parentId: folderId, index, mark: item, cls: 'drop-before' } : { parentId: folderId, index: index + 1, mark: item, cls: 'drop-after' };
}

function endDrag() {
  drag.id = null;
  drag.hoverId = null;
  clearTimeout(drag.hoverTimer);
  clearDropMarks();
  $('bm-columns').classList.remove('is-dragging');
}

$('bm-columns').addEventListener('dragstart', (e) => {
  const row = e.target.closest?.('.bm-row[draggable="true"]');
  if (!row) return;
  closeMenu(true);
  drag.id = row.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/x-bookmark-id', drag.id);
  const node = view.nodes.get(drag.id);
  if (node?.url) e.dataTransfer.setData('text/uri-list', node.url);
  $('bm-columns').classList.add('is-dragging');
});

$('bm-columns').addEventListener('dragover', (e) => {
  if (!drag.id) return;
  const t = dropTarget(e);
  clearDropMarks();
  if (!t || !canDrop(view.tree, drag.id, t.parentId)) {
    clearTimeout(drag.hoverTimer);
    drag.hoverId = null;
    return;
  }
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  t.mark.classList.add(t.cls);
  if (t.folder && drag.hoverId !== t.folder.id) {
    drag.hoverId = t.folder.id;
    clearTimeout(drag.hoverTimer);
    const colIndex = Number(t.mark.querySelector('.bm-row')?.dataset.col ?? 0);
    drag.hoverTimer = setTimeout(() => {
      if (drag.id && drag.hoverId === t.folder.id && view.path[colIndex] !== t.folder.id) openFolder(t.folder.id, colIndex);
    }, 600);
  } else if (!t.folder) {
    drag.hoverId = null;
    clearTimeout(drag.hoverTimer);
  }
});

$('bm-columns').addEventListener('dragleave', (e) => {
  if (!$('bm-columns').contains(e.relatedTarget)) clearDropMarks();
});

$('bm-columns').addEventListener('drop', async (e) => {
  if (!drag.id) return;
  const t = dropTarget(e);
  const id = drag.id;
  endDrag();
  if (!t || !canDrop(view.tree, id, t.parentId)) return;
  e.preventDefault();
  const dest = { parentId: t.parentId };
  if (t.index !== undefined) dest.index = t.index;
  try {
    await api().move(id, dest);
  } catch (err) {
    toast(err.message);
  }
});

document.addEventListener('dragend', endDrag);
