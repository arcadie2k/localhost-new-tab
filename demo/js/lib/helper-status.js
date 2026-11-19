function newer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

export function helperStatus(info, bundledHash, bundledVersion) {
  if (!bundledHash) return 'unknown';
  if (!info || !info.hash) return 'legacy';
  if (info.hash === bundledHash) return 'current';
  return bundledVersion && newer(info.version, bundledVersion) ? 'newer' : 'outdated';
}
