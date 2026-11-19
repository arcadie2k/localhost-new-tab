import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isForeignApp } = require('../host/host.js');

const ROOT = '/Users/me/code/law-case-tracker-app';

test('an app bundle outside the project is not the project server', () => {
  assert.equal(isForeignApp('/Users/me/Library/Application Support/Claude/claude-code/2.1.326/x/claude.app/Contents/MacOS/claude --resume', ROOT), true);
  assert.equal(isForeignApp('/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin) --type=utility', ROOT), true);
});

test('dev servers and Electron apps built in the project still count', () => {
  assert.equal(isForeignApp('node /Users/me/code/law-case-tracker-app/node_modules/.bin/next dev', ROOT), false);
  assert.equal(isForeignApp('next-server (v15.1.0)', ROOT), false);
  assert.equal(isForeignApp(`${ROOT}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`, ROOT), false);
});
