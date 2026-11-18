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
