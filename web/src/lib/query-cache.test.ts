import { dehydrate, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetQueryCache,
  ownQueryCache,
  persistOptions,
  queryCacheOwner,
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
