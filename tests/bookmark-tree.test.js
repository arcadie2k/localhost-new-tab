import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnsFor, countBookmarks, displayTitle, isBookmarklet, isFixedNode, restoreTree } from '../extension/js/lib/bookmark-tree.js';
import { makeTree } from './fixtures/bookmarks.js';

const tree = makeTree();

test('first column is the root children', () => {
  const cols = columnsFor(tree, []);
  assert.deepEqual(cols.map((c) => c.folder.id), ['0']);
  assert.deepEqual(cols[0].children.map((n) => n.id), ['1', '2']);
});

test('columns follow the path', () => {
  const cols = columnsFor(tree, ['1', '10']);
  assert.deepEqual(cols.map((c) => c.folder.id), ['0', '1', '10']);
  assert.deepEqual(cols[2].children.map((n) => n.id), ['100', 'b1', 'b2', 'b3']);
});

test('path truncates at a deleted folder', () => {
  assert.deepEqual(columnsFor(tree, ['1', '999', '100']).map((c) => c.folder.id), ['0', '1']);
});

test('path stops at a bookmark id', () => {
  assert.deepEqual(columnsFor(tree, ['1', 'b5']).map((c) => c.folder.id), ['0', '1']);
});

test('displayTitle uses the title', () => assert.equal(displayTitle({ title: 'Linear', url: 'https://linear.app/' }), 'Linear'));

test('displayTitle falls back to hostname', () => {
  assert.equal(displayTitle({ title: '', url: 'https://www.linear.app/team' }), 'linear.app');
});

test('displayTitle falls back to Untitled', () => assert.equal(displayTitle({ title: '  ' }), 'Untitled'));

test('bookmarklet detection', () => {
  assert.equal(isBookmarklet({ url: 'javascript:alert(1)' }), true);
  assert.equal(isBookmarklet({ url: 'https://a.com' }), false);
  assert.equal(isBookmarklet({ title: 'folder' }), false);
});

test('fixed nodes', () => {
  assert.equal(isFixedNode({ id: '0' }), true);
  assert.equal(isFixedNode({ id: '1', parentId: '0' }), true);
  assert.equal(isFixedNode({ id: '10', parentId: '1' }), false);
});

test('countBookmarks counts only urls, nested included', () => {
  const work = tree.children[0].children[0];
  assert.equal(countBookmarks(work), 4);
  assert.equal(countBookmarks({ title: 'empty', children: [] }), 0);
});

test('restoreTree recreates in order under the new ids', async () => {
  const calls = [];
  let n = 0;
  const api = { create: async (o) => (calls.push(o), { id: String(++n) }) };
  const id = await restoreTree(api, { title: 'Work', children: [{ title: 'A', url: 'https://a.com' }, { title: 'Sub', children: [{ title: 'B', url: 'https://b.com' }] }] }, 'p', 2);
  assert.equal(id, '1');
  assert.deepEqual(calls, [
    { parentId: 'p', index: 2, title: 'Work' },
    { parentId: '1', index: 0, title: 'A', url: 'https://a.com' },
    { parentId: '1', index: 1, title: 'Sub' },
    { parentId: '3', index: 0, title: 'B', url: 'https://b.com' },
  ]);
});

test('restoreTree restores a single bookmark', async () => {
  const calls = [];
  const api = { create: async (o) => (calls.push(o), { id: 'x' }) };
  await restoreTree(api, { title: 'A', url: 'https://a.com' }, 'p', 0);
  assert.deepEqual(calls, [{ parentId: 'p', index: 0, title: 'A', url: 'https://a.com' }]);
});

test('normalizeUrl adds https and rejects junk', async () => {
  const { normalizeUrl } = await import('../extension/js/lib/bookmark-tree.js');
  assert.equal(normalizeUrl('strava.com'), 'https://strava.com');
  assert.equal(normalizeUrl('  http://localhost:3000/ '), 'http://localhost:3000/');
  assert.equal(normalizeUrl('not a url with spaces'), null);
  assert.equal(normalizeUrl('https://not a url'), null);
  assert.equal(normalizeUrl('justaword'), null);
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('mailto:me@example.com'), 'mailto:me@example.com');
  assert.equal(normalizeUrl('localhost:3000'), 'https://localhost:3000');
});
