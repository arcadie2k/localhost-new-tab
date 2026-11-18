import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTopSites } from '../extension/js/lib/top-sites.js';

const s = (url, title = url) => ({ url, title });

test('drops localhost and 127.0.0.1', () => {
  const out = pickTopSites([s('http://localhost:3000/'), s('http://127.0.0.1:8080/x'), s('https://github.com/')], []);
  assert.deepEqual(out.map((x) => x.url), ['https://github.com/']);
});

test('drops hidden urls', () => {
  assert.deepEqual(pickTopSites([s('https://a.com/'), s('https://b.com/')], ['https://a.com/']).map((x) => x.url), ['https://b.com/']);
});

test('caps at limit after filtering', () => {
  const many = [s('http://localhost/'), ...Array.from({ length: 12 }, (_, i) => s(`https://s${i}.com/`))];
  assert.equal(pickTopSites(many, []).length, 10);
  assert.equal(pickTopSites(many, [])[0].url, 'https://s0.com/');
});

test('empty title falls back to hostname without www', () => {
  assert.equal(pickTopSites([s('https://www.figma.com/files', '')], [])[0].title, 'figma.com');
});

test('skips entries with unparseable urls', () => {
  assert.deepEqual(pickTopSites([s('not a url'), s('https://ok.com/')], []).map((x) => x.url), ['https://ok.com/']);
});
