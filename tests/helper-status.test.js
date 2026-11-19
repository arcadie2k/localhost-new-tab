import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helperStatus } from '../extension/js/lib/helper-status.js';

test('same hash as the bundled helper is current', () => {
  assert.equal(helperStatus({ version: '1.1.1', hash: 'abc' }, 'abc'), 'current');
});

test('a different hash is outdated and gets updated', () => {
  assert.equal(helperStatus({ version: '1.1.0', hash: 'old' }, 'abc'), 'outdated');
});

test('a helper that reports nothing predates self-update', () => {
  assert.equal(helperStatus(undefined, 'abc'), 'legacy');
  assert.equal(helperStatus({}, 'abc'), 'legacy');
});

test('without a bundled helper (demo) nothing is known', () => {
  assert.equal(helperStatus(undefined, null), 'unknown');
  assert.equal(helperStatus({ hash: 'x' }, null), 'unknown');
});

test('a newer helper is never downgraded by an older extension', () => {
  assert.equal(helperStatus({ version: '1.2.0', hash: 'new' }, 'abc', '1.1.1'), 'newer');
  assert.equal(helperStatus({ version: '1.10.0', hash: 'new' }, 'abc', '1.9.0'), 'newer');
  assert.equal(helperStatus({ version: '1.1.0', hash: 'old' }, 'abc', '1.1.1'), 'outdated');
  assert.equal(helperStatus({ version: '1.1.1', hash: 'dev' }, 'abc', '1.1.1'), 'outdated');
});
