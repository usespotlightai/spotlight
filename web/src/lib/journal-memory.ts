import type { QueryClient } from '@tanstack/react-query';

// Run journals stay in memory by count rather than by age, so a run seen
// a while ago opens at once instead of waiting for IndexedDB.
export const JOURNALS_KEPT = 30;

const isJournal = (queryKey: readonly unknown[]): boolean =>
  queryKey[0] === 'journal';

export const keepRecentJournals = (
  client: QueryClient,
  kept = JOURNALS_KEPT,
): (() => void) => {
  const cache = client.getQueryCache();
  const used = new Map<string, number>();
  let clock = 0;

  return cache.subscribe((event) => {
    const { query } = event;

    if (!isJournal(query.queryKey as readonly unknown[])) {
      return;
    }

    if (event.type === 'removed') {
      used.delete(query.queryHash);
      return;
    }

    if (
      event.type !== 'added' &&
      event.type !== 'observerAdded' &&
      event.type !== 'observerRemoved'
    ) {
      return;
    }

    clock += 1;
    used.set(query.queryHash, clock);

    const journals = cache.findAll({
      predicate: (each) => isJournal(each.queryKey),
    });
    const idle = journals
      .filter((each) => each.getObserversCount() === 0)
      .sort(
        (a, b) => (used.get(a.queryHash) ?? 0) - (used.get(b.queryHash) ?? 0),
      );

    for (const each of idle.slice(0, Math.max(0, journals.length - kept))) {
      cache.remove(each);
    }
  });
};
