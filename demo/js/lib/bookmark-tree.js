import { hostLabel } from './top-sites.js';

export function columnsFor(root, path) {
  const cols = [{ folder: root, children: root.children || [] }];
  for (const id of path || []) {
    const next = cols[cols.length - 1].children.find((n) => n.id === id);
    if (!next || !next.children) break;
    cols.push({ folder: next, children: next.children });
  }
  return cols;
}

export function displayTitle(node) {
  const title = (node.title || '').trim();
  if (title) return title;
  return (node.url && hostLabel(node.url)) || 'Untitled';
}

export function isBookmarklet(node) {
  return typeof node.url === 'string' && /^javascript:/i.test(node.url);
}

export function isFixedNode(node) {
  return node.id === '0' || node.parentId === '0';
}

export function countBookmarks(node) {
  if (node.url) return 1;
  return (node.children || []).reduce((sum, c) => sum + countBookmarks(c), 0);
}

export async function restoreTree(api, snapshot, parentId, index) {
  const props = { parentId, index, title: snapshot.title || '' };
  if (snapshot.url !== undefined) props.url = snapshot.url;
  const { id } = await api.create(props);
  if (!snapshot.url && snapshot.children) {
    for (const [i, child] of snapshot.children.entries()) await restoreTree(api, child, id, i);
  }
  return id;
}

export function normalizeUrl(raw) {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (/^https?:$/.test(u.protocol) && !u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return withScheme;
  } catch {
    return null;
  }
}
