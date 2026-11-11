import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import {
  onQueryCacheOwnerChange,
  ownQueryCache,
  queryCacheOwner,
} from '@/lib/query-cache';

export function useQueryCacheOwnedBy(userId: string | null): boolean {
  const queryClient = useQueryClient();
  const owner = useSyncExternalStore(onQueryCacheOwnerChange, queryCacheOwner);
  const owned = userId === null || owner === userId;

  useEffect(() => {
    if (owned || userId === null) {
      return;
    }

    void queryClient.resetQueries();
    ownQueryCache(userId);
  }, [owned, userId, queryClient]);

  return owned;
}
