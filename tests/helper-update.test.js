import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const helperPath = new URL('../extension/helper/host.js', import.meta.url).pathname;
const { helperInfo, installHelper, HELPER_VERSION } = require(helperPath);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const manifest = JSON.parse(fs.readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

function sandbox(contents = 'old helper') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lnt-helper-'));
  const file = path.join(dir, 'host.js');
  fs.writeFileSync(file, contents);
  return file;
}

test('helper version matches the extension version', () => {
  assert.equal(HELPER_VERSION, manifest.version);
});

test('helperInfo reports the version and the hash of the file on disk', () => {
  assert.deepEqual(helperInfo(helperPath), { version: HELPER_VERSION, hash: sha(fs.readFileSync(helperPath)) });
});

const realSource = fs.readFileSync(helperPath, 'utf8');

test('installHelper replaces the file and keeps the previous one', () => {
  const file = sandbox();
  const source = realSource + '\n// next release\n';
  const res = installHelper({ source, hash: sha(source) }, file);
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  assert.equal(fs.readFileSync(file.replace(/\.js$/, '.prev.js'), 'utf8'), 'old helper');
  assert.equal(res.hash, sha(source));
});

test('installHelper refuses a checksum mismatch and leaves the file alone', () => {
  const file = sandbox();
  assert.throws(() => installHelper({ source: 'console.log(1)', hash: sha('something else') }, file), /checksum/i);
  assert.equal(fs.readFileSync(file, 'utf8'), 'old helper');
});

test('installHelper refuses code that does not parse', () => {
  const file = sandbox();
  const source = 'function (';
  assert.throws(() => installHelper({ source, hash: sha(source) }, file));
  assert.equal(fs.readFileSync(file, 'utf8'), 'old helper');
});

test('install.sh downloads the helper from the same release', () => {
  const script = fs.readFileSync(new URL('../install.sh', import.meta.url), 'utf8');
  assert.equal(script.match(/^VERSION="([^"]+)"/m)[1], manifest.version);
});

test('installHelper refuses code that parses but crashes on start', () => {
  const file = sandbox();
  const source = "throw new Error('boom');\n";
  assert.throws(() => installHelper({ source, hash: sha(source) }, file), /start/i);
  assert.equal(fs.readFileSync(file, 'utf8'), 'old helper');
});

test('installing the same build twice keeps the real previous version', () => {
  const file = sandbox();
  const source = realSource + '\n// next release\n';
  installHelper({ source, hash: sha(source) }, file);
  installHelper({ source, hash: sha(source) }, file);
  assert.equal(fs.readFileSync(file.replace(/\.js$/, '.prev.js'), 'utf8'), 'old helper');
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp')), []);
});
