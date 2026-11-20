import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { keepRecentJournals } from '@/lib/journal-memory';

const watch = (client: QueryClient, queryKey: readonly unknown[]) => {
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () => Promise.resolve([]),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return observer.subscribe(() => {});
};

const journals = (client: QueryClient) =>
  client
    .getQueryCache()
    .findAll({ predicate: (query) => query.queryKey[0] === 'journal' })
    .map((query) => query.queryKey[1]);

describe('keepRecentJournals', () => {
  it('keeps the journals used last and drops the oldest idle ones', () => {
    const client = new QueryClient();
    keepRecentJournals(client, 2);

    for (const run of ['a', 'b', 'c']) {
      watch(client, ['journal', run])();
    }

    expect(journals(client)).toEqual(['b', 'c']);
  });

  it('never drops a journal that is shown', () => {
    const client = new QueryClient();
    keepRecentJournals(client, 1);

    const shown = watch(client, ['journal', 'a']);
    watch(client, ['journal', 'b'])();
    watch(client, ['journal', 'c'])();

    expect(journals(client)).toContain('a');
    shown();
  });

  it('leaves other queries alone', () => {
    const client = new QueryClient();
    keepRecentJournals(client, 0);

    watch(client, ['inbox', 'open'])();

    expect(
      client.getQueryCache().findAll({ queryKey: ['inbox'] }),
    ).toHaveLength(1);
  });
});
