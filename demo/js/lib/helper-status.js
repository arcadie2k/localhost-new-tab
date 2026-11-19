function parse(v) {
  const parts = String(v || '').split('.');
  return parts.length === 3 && parts.every((x) => /^\d+$/.test(x)) ? parts.map(Number) : null;
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

export function helperStatus(info, bundledHash, bundledVersion) {
  if (!bundledHash) return 'unknown';
  if (!info || !info.hash) return 'legacy';
  if (info.hash === bundledHash) return 'current';
  const have = parse(info.version);
  const ship = parse(bundledVersion);
  if (!have || !ship) return 'modified';
  const order = compare(have, ship);
  return order < 0 ? 'outdated' : order > 0 ? 'newer' : 'modified';
}
