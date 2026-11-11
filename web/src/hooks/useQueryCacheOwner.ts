import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import {
  onQueryCacheOwnerChange,
  ownQueryCache,
  queryCacheOwner,
} from '@/lib/query-cache';

export function useQueryCacheOwnedBy(userId: string | null): boolean {
  const queryClient = useQueryClient();
  const owner = useSyncExternalStore(onQueryCacheOwnerChange, queryCacheOwner);
  const restoring = useIsRestoring();
  const owned = !restoring && (userId === null || owner === userId);

  useEffect(() => {
    if (restoring || owned || userId === null) {
      return;
    }

    void queryClient.resetQueries();
    ownQueryCache(userId);
  }, [restoring, owned, userId, queryClient]);

  return owned;
}
