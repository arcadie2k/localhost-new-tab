import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrefs, isSectionOn, needsBadge } from '../extension/js/lib/prefs.js';

test('defaults', () => {
  const p = normalizePrefs(undefined);
  assert.equal(p.view, 'grid');
  assert.deepEqual(p.sections, { pinned: true, running: true, services: true, recent: true, mostVisited: false, bookmarks: false });
  assert.deepEqual(p.hiddenSites, []);
});

test('keeps existing view and app choices', () => {
  const p = normalizePrefs({ view: 'list', editor: 'Cursor' });
  assert.equal(p.view, 'list');
  assert.equal(p.editor, 'Cursor');
});

test('bad view falls back to grid', () => assert.equal(normalizePrefs({ view: 'x' }).view, 'grid'));

test('isSectionOn reads toggles', () => {
  const p = normalizePrefs({ sections: { recent: false } });
  assert.equal(isSectionOn(p, 'recent'), false);
  assert.equal(isSectionOn(p, 'running'), true);
});

test('badge until both granted', () => {
  assert.equal(needsBadge({ topSites: true, bookmarks: false }), true);
  assert.equal(needsBadge({ topSites: true, bookmarks: true }), false);
});
