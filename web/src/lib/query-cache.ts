import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import type {
  PersistedClient,
  PersistedQuery,
  PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

import {
  createStoredJournals,
  indexedJournalStorage,
} from '@/lib/stored-journals';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { persist?: boolean };
  }
}

const CACHE_KEY = 'spotlight:query-cache';
const OWNER_KEY = 'spotlight:query-cache-owner';

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const QUERY_RESULT_SHAPE_VERSION = 1;

const RESTORED_JOURNALS = 8;

const bustedBy = (apiShape: string) =>
  `${QUERY_RESULT_SHAPE_VERSION}-${apiShape}`;

export const storedJournals = createStoredJournals(indexedJournalStorage(), {
  buster: bustedBy(import.meta.env.VITE_API_SHAPE),
  maxAge: CACHE_MAX_AGE_MS,
});

const cachePersister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: async (key) => (await get<string>(key)) ?? null,
    setItem: async (key, value) => set(key, value),
    removeItem: async (key) => del(key),
  },
});

export const withJournals = (
  client: PersistedClient | undefined,
  journals: readonly PersistedQuery[],
): PersistedClient | undefined =>
  client && {
    ...client,
    clientState: {
      ...client.clientState,
      queries: [
        ...client.clientState.queries,
        ...journals.map(({ queryKey, queryHash, state }) => ({
          queryKey,
          queryHash,
          state,
          dehydratedAt: state.dataUpdatedAt,
          meta: { persist: false },
        })),
      ],
    },
  };

const persister = {
  ...cachePersister,
  restoreClient: async () => {
    const [client, journals] = await Promise.all([
      cachePersister.restoreClient(),
      storedJournals.recent(RESTORED_JOURNALS),
    ]);
    return withJournals(client, journals);
  },
};

const shouldPersistQuery = (query: Query): boolean =>
  query.meta?.persist !== false &&
  query.state.data !== null &&
  defaultShouldDehydrateQuery(query);

export const persistOptions = (
  apiShape: string,
): Omit<PersistQueryClientOptions, 'queryClient'> => ({
  persister,
  buster: bustedBy(apiShape),
  maxAge: CACHE_MAX_AGE_MS,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
});

let rememberedOwner: string | null = null;
const ownerListeners = new Set<() => void>();

export const queryCacheOwner = (): string | null => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return rememberedOwner;
  }
};

export const onQueryCacheOwnerChange = (listener: () => void) => {
  ownerListeners.add(listener);
  return () => {
    ownerListeners.delete(listener);
  };
};

const storeOwner = (userId: string) => {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    return;
  }
};

const ownerChanged = () => {
  for (const listener of ownerListeners) {
    listener();
  }
};

export const ownQueryCache = (userId: string): void => {
  void storedJournals.forget();
  rememberedOwner = userId;
  storeOwner(userId);
  ownerChanged();
};

const forgetOwner = () => {
  rememberedOwner = null;
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    return;
  } finally {
    ownerChanged();
  }
};

export const forgetQueryCache = async (): Promise<void> => {
  forgetOwner();
  await storedJournals.forget();
  try {
    await persister.removeClient();
  } catch {
    return;
  }
};
