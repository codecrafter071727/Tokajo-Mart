/** Most recent first, no duplicates (case insensitive), at most `max` entries. */
export function rememberSearch(list: string[], term: string, max = 8): string[] {
  const clean = term.trim().replace(/\s+/g, " ");
  if (clean.length < 2) return list;
  const lower = clean.toLowerCase();
  return [clean, ...list.filter((t) => t.toLowerCase() !== lower)].slice(0, max);
}
