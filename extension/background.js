'use strict';

const HOST = 'com.arcadie.localhost_newtab';
const CAPTURE_EVERY_MS = 5 * 60 * 1000;
const THUMB_WIDTH = 800;

function host(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(HOST, msg, (res) => {
      const err = chrome.runtime.lastError;
      if (err || !res || res.error) reject(new Error(err ? err.message : res && res.error));
      else resolve(res);
    });
  });
}

const UNINSTALL_URL = 'https://arcadie2k.github.io/localhost-new-tab/uninstall/';

function ensureAlarm() {
  chrome.runtime.setUninstallURL(UNINSTALL_URL).catch(() => {});
  chrome.alarms.get('scan', (alarm) => {
    if (!alarm) chrome.alarms.create('scan', { periodInMinutes: 1 });
  });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'scan') host({ type: 'scan' }).catch(() => {});
});

function localPort(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(u.hostname)) return null;
    return Number(u.port) || 80;
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function downscale(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, THUMB_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(Math.min(bitmap.height, bitmap.width * 0.625) * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, bitmap.width, height / scale, 0, 0, width, height);
  return blobToDataUrl(await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 }));
}

async function capture(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const port = tab && tab.active && localPort(tab.url);
  if (!port) return;

  const { projects } = await host({ type: 'scan' });
  const project = projects.find((p) => p.ports.some((x) => x.live && x.port === port));
  if (!project) return;

  const key = `thumb:${project.id}`;
  const existing = (await chrome.storage.local.get(key))[key];
  if (existing && existing.source === 'tab' && Date.now() - existing.at < CAPTURE_EVERY_MS) return;

  const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 });
  const update = { [key]: { url: await downscale(shot), at: Date.now(), source: 'tab' } };

  const iconKey = `icon:${project.id}`;
  const { icon } = await host({ type: 'icon', port }).catch(() => ({}));
  if (icon) update[iconKey] = { url: icon, at: Date.now() };
  await chrome.storage.local.set(update);
}

const timers = new Map();

function scheduleCapture(tabId, delay) {
  clearTimeout(timers.get(tabId));
  timers.set(
    tabId,
    setTimeout(() => {
      timers.delete(tabId);
      capture(tabId).catch(() => {});
    }, delay)
  );
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && localPort(tab.url)) scheduleCapture(tabId, 1500);
});

chrome.tabs.onActivated.addListener(({ tabId }) => scheduleCapture(tabId, 800));
