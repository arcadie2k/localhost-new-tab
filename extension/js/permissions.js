export const FEATURE_PERMISSION = { mostVisited: 'topSites', bookmarks: 'bookmarks' };

export async function hasPermission(name) {
  try {
    return Boolean(await chrome.permissions?.contains({ permissions: [name] }));
  } catch {
    return false;
  }
}

export function requestPermission(name) {
  try {
    return Promise.resolve(chrome.permissions.request({ permissions: [name] })).then(Boolean, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

export async function grantedMap() {
  const [topSites, bookmarks] = await Promise.all([hasPermission('topSites'), hasPermission('bookmarks')]);
  return { topSites, bookmarks };
}

export function onPermissionsChange(fn) {
  chrome.permissions?.onAdded?.addListener(fn);
  chrome.permissions?.onRemoved?.addListener(fn);
}
