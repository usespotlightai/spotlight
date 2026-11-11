import {
  IsRestoringProvider,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useQueryCacheOwnedBy } from '@/hooks/useQueryCacheOwner';
import { ownQueryCache, queryCacheOwner } from '@/lib/query-cache';

const cachedFor = (owner: string | null, restoring = false) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['inbox'], ['item of the earlier user']);
  if (owner) {
    ownQueryCache(owner);
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <IsRestoringProvider value={restoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  );

  return { queryClient, wrapper };
};

beforeEach(() => localStorage.clear());

describe('useQueryCacheOwnedBy', () => {
  it('waits for the saved cache to load before it compares the owner', () => {
    const { queryClient, wrapper } = cachedFor('user_1', true);

    const { result } = renderHook(() => useQueryCacheOwnedBy('user_2'), {
      wrapper,
    });

    expect(result.current).toBe(false);
    expect(queryCacheOwner()).toBe('user_1');
    expect(queryClient.getQueryData(['inbox'])).toEqual([
      'item of the earlier user',
    ]);
  });

  it('keeps the cache of the same user', () => {
    const { queryClient, wrapper } = cachedFor('user_1');

    const { result } = renderHook(() => useQueryCacheOwnedBy('user_1'), {
      wrapper,
    });

    expect(result.current).toBe(true);
    expect(queryClient.getQueryData(['inbox'])).toEqual([
      'item of the earlier user',
    ]);
  });

  it('drops the cache of a different user before it shows', async () => {
    const { queryClient, wrapper } = cachedFor('user_1');

    const { result } = renderHook(() => useQueryCacheOwnedBy('user_2'), {
      wrapper,
    });

    expect(queryClient.getQueryData(['inbox'])).toBeUndefined();
    await waitFor(() => expect(result.current).toBe(true));
    expect(queryCacheOwner()).toBe('user_2');
  });

  it('drops a cache without an owner', async () => {
    const { queryClient, wrapper } = cachedFor(null);

    const { result } = renderHook(() => useQueryCacheOwnedBy('user_1'), {
      wrapper,
    });

    expect(queryClient.getQueryData(['inbox'])).toBeUndefined();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('waits for no one without a session', () => {
    const { wrapper } = cachedFor('user_1');

    const { result } = renderHook(() => useQueryCacheOwnedBy(null), {
      wrapper,
    });

    expect(result.current).toBe(true);
  });
});
