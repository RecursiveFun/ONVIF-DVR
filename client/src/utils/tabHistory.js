/**
 * Recently-used tab order for restoring focus after closes and removals.
 */

/** Walk history newest-first and return the first tab that still exists. */
export function pickRecentTab(history, remaining, excludeIds = []) {
  const excluded = new Set(excludeIds);
  const remainingIds = new Set(remaining.map((tab) => tab.id));

  for (const id of history) {
    if (excluded.has(id)) continue;
    if (remainingIds.has(id)) return id;
  }

  for (const tab of remaining) {
    if (!excluded.has(tab.id)) return tab.id;
  }

  return null;
}

export function pruneTabHistory(history, removedIds) {
  const removed = new Set(removedIds);
  return history.filter((id) => !removed.has(id));
}
