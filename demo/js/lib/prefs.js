export const SECTION_IDS = ['pinned', 'running', 'services', 'recent', 'mostVisited', 'bookmarks'];

const SECTION_DEFAULTS = { pinned: true, running: true, services: true, recent: true, mostVisited: false, bookmarks: false };

export function normalizePrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const sections = {};
  for (const id of SECTION_IDS) {
    const v = src.sections && src.sections[id];
    sections[id] = typeof v === 'boolean' ? v : SECTION_DEFAULTS[id];
  }
  return {
    ...src,
    view: src.view === 'list' ? 'list' : 'grid',
    sections,
    hiddenSites: Array.isArray(src.hiddenSites) ? src.hiddenSites.filter((u) => typeof u === 'string') : [],
  };
}

export function isSectionOn(prefs, id) {
  return Boolean(prefs && prefs.sections && prefs.sections[id]);
}

export function needsBadge(granted) {
  return !(granted && granted.topSites && granted.bookmarks);
}
