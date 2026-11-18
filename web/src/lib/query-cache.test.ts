import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetQueryCache,
  ownQueryCache,
  persistOptions,
  queryCacheOwner,
  withJournals,
} from '@/lib/query-cache';

const persisted = (queryClient: QueryClient) =>
  dehydrate(queryClient, persistOptions('api').dehydrateOptions).queries.map(
    ({ queryKey }) => queryKey,
  );

beforeEach(() => localStorage.clear());

describe('persistOptions', () => {
  it('keeps successful queries', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['inbox'], ['item']);

    expect(persisted(queryClient)).toEqual([['inbox']]);
  });

  it('leaves out queries marked not to persist', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['inbox'], ['item']);
    await queryClient.query({
      queryKey: ['auth', 'device', 'ABCD'],
      queryFn: () => 'pending',
      meta: { persist: false },
    });

    expect(persisted(queryClient)).toEqual([['inbox']]);
  });

  it('leaves out failed queries', async () => {
    const queryClient = new QueryClient();
    await queryClient
      .query({
        queryKey: ['inbox'],
        queryFn: () => Promise.reject(new Error('down')),
        retry: false,
      })
      .catch(() => undefined);

    expect(persisted(queryClient)).toEqual([]);
  });

  it('leaves out queries that found nothing, such as a signed-out session', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['inbox'], ['item']);
    queryClient.setQueryData(['auth', 'session'], null);

    expect(persisted(queryClient)).toEqual([['inbox']]);
  });

  it('keeps a cache across builds of the same API', () => {
    expect(persistOptions('api_1').buster).toBe(persistOptions('api_1').buster);
  });

  it('drops a cache saved against another API', () => {
    expect(persistOptions('api_2').buster).not.toBe(
      persistOptions('api_1').buster,
    );
  });
});

describe('forgetQueryCache', () => {
  it('forgets the owner, also when the saved cache cannot be removed', async () => {
    ownQueryCache('user_1');

    await forgetQueryCache();

    expect(queryCacheOwner()).toBeNull();
  });
});

describe('withJournals', () => {
  const journal = () => {
    const stored = new QueryClient();
    stored.setQueryData(['journal', 'run_1'], ['step'], { updatedAt: 1_000 });
    const [query] = dehydrate(stored).queries;
    return { ...query, buster: 'api' };
  };

  it('restores stored journals with the cache, and keeps them out of the next save', () => {
    const cached = new QueryClient();
    cached.setQueryData(['inbox'], ['item']);
    const client = withJournals(
      { buster: 'api', timestamp: 1, clientState: dehydrate(cached) },
      [journal()],
    );

    const restored = new QueryClient();
    hydrate(restored, client?.clientState ?? {});

    expect(restored.getQueryData(['journal', 'run_1'])).toEqual(['step']);
    expect(restored.getQueryState(['journal', 'run_1'])?.dataUpdatedAt).toBe(
      1_000,
    );
    expect(persisted(restored)).toEqual([['inbox']]);
  });

  it('restores no journals when there is no saved cache', () => {
    expect(withJournals(undefined, [journal()])).toBeUndefined();
  });
});
