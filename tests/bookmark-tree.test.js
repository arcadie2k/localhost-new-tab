import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnsFor, displayTitle, isBookmarklet, isFixedNode } from '../extension/js/lib/bookmark-tree.js';
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
