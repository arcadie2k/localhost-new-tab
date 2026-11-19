import { $, state, toast } from './core.js';
import { helperStatus } from './lib/helper-status.js';

let bundled = null;
let attempted = false;
let failed = false;
let inflight = null;
let hostFn = null;

const LABELS = {
  current: (v) => `Helper v${v} · up to date`,
  newer: (v) => `Helper v${v} · newer than this extension`,
  modified: (v) => `Helper v${v} · local build`,
  failed: () => 'Helper update failed',
  outdated: (v) => `Helper v${v} · update failed`,
  legacy: () => 'Helper needs a one-time update',
  unknown: () => '',
};

async function loadBundled() {
  if (bundled !== null) return bundled;
  try {
    const buf = await (await fetch(chrome.runtime.getURL('helper/host.js'))).arrayBuffer();
    if (!buf.byteLength) throw new Error('No bundled helper');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    bundled = { hash: [...digest].map((b) => b.toString(16).padStart(2, '0')).join(''), source: new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }).decode(buf) };
  } catch {
    bundled = false;
  }
  return bundled;
}

export function setupCommand() {
  const version = chrome.runtime.getManifest?.().version || '1.0.0';
  return `curl -fsSL https://raw.githubusercontent.com/arcadie2k/localhost-new-tab/v${version}/install.sh | sh -s -- ${chrome.runtime.id}`;
}

export function syncHelper(info, host) {
  hostFn = host;
  if (!inflight) inflight = applyHelper(info, host).finally(() => (inflight = null));
  return inflight;
}

async function applyHelper(info, host) {
  const own = await loadBundled();
  const version = chrome.runtime.getManifest?.().version;
  let status = helperStatus(info, own && own.hash, version);
  let current = info;
  if (status === 'outdated' && !attempted) {
    attempted = true;
    try {
      const res = await host({ type: 'update', source: own.source, hash: own.hash });
      current = { version: res.version, hash: res.hash };
      status = helperStatus(current, own.hash, version);
      if (status === 'current') toast(`Helper updated to v${res.version}`);
    } catch (e) {
      console.warn('Helper update failed:', e.message);
    }
    failed = status === 'outdated';
  }
  if (status === 'outdated' && failed) status = 'failed';
  state.helper = { ...(current || {}), status };
  $('helper-status').textContent = LABELS[status](state.helper.version);
  const needsCommand = status === 'legacy' || status === 'failed';
  $('helper-notice').hidden = !needsCommand;
  if (needsCommand) $('helper-command').textContent = setupCommand();
}

$('helper-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(setupCommand());
  toast('Command copied. Paste it in Terminal, then reload this tab.');
});

$('copy-diag').addEventListener('click', async () => {
  const report = {
    extension: chrome.runtime.getManifest?.().version,
    browser: navigator.userAgent,
    helperStatus: state.helper?.status || 'not connected',
  };
  try {
    report.helper = hostFn ? await hostFn({ type: 'diag' }) : null;
  } catch (e) {
    report.helper = { error: e.message };
  }
  await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  toast('Diagnostics copied.');
});
