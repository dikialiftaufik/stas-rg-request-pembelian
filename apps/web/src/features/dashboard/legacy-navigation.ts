export function legacyDestination(path: string, search: string): string | null {
  if (!['/requests', '/dashboard'].includes(path)) return null;
  const params = new URLSearchParams(search);
  const detail = params.get('detail');
  const create = params.has('create');
  const rab = params.get('rab');
  const tab = params.get('tab');
  if (!detail && !create && tab !== 'rab') return null;
  const source = new URLSearchParams();
  for (const key of ['sourceRab', 'sourceItem']) {
    const value = params.get(key);
    if (value && create) source.set(key, value);
    params.delete(key);
  }
  for (const key of ['detail', 'create', 'tab', 'rab']) params.delete(key);
  const base = tab === 'rab' ? '/requests/rab' : path;
  const back = `${base}${params.size ? `?${params}` : ''}`;
  const target = create
    ? '/requests/new'
    : detail
      ? `/requests/${encodeURIComponent(detail)}`
      : rab
        ? `/requests/rab/${encodeURIComponent(rab)}`
        : '/requests/rab';
  if (detail || create || rab) source.set('returnTo', back);
  else params.forEach((value, key) => source.set(key, value));
  return `${target}${source.size ? `?${source}` : ''}`;
}
