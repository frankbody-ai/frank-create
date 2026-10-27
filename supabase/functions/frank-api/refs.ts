// Reference images for a run, once each and in the order the app attached them.

/** The stored file a signed storage link points at; any other URL is its own key. */
export function referenceKey(url: string): string {
  const match = url.match(/\/storage\/v1\/object\/sign\/([^?#]+)/);
  if (!match) return url;
  try {
    return `storage:${decodeURIComponent(match[1])}`;
  } catch (_) {
    return `storage:${match[1]}`;
  }
}

/**
 * One link per image, in first-seen order. The app sends signed links for its
 * dock and the server signs the same files again, and only identical strings
 * were merged, so every reference reached the provider twice: 2 became 4, and
 * 9 became 18 and broke a model's limit of 16 (27 Oct 2026). Links to the
 * same stored file now count once. The last link seen wins, because the
 * server's own link comes after the app's, and the app's can be a day old.
 */
export function uniqueReferenceUrls(urls: string[]): string[] {
  const order: string[] = [];
  const latest = new Map<string, string>();
  for (const url of urls) {
    const key = referenceKey(url);
    if (!latest.has(key)) order.push(key);
    latest.set(key, url);
  }
  return order.map((key) => latest.get(key)!);
}

/** Rows put back in the order of the ids asked for; ids with no row are skipped. */
export function inRequestedOrder<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row && !seen.has(id)) {
      seen.add(id);
      out.push(row);
    }
  }
  return out;
}
