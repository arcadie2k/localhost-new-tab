const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function pickTopSites(sites, hidden, limit = 10) {
  const skip = new Set(hidden || []);
  const out = [];
  for (const site of sites || []) {
    let host;
    try {
      host = new URL(site.url).hostname;
    } catch {
      continue;
    }
    if (LOCAL_HOSTS.has(host) || skip.has(site.url)) continue;
    out.push({ url: site.url, title: (site.title || '').trim() || hostLabel(site.url) });
    if (out.length === limit) break;
  }
  return out;
}
