import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { persist?: boolean };
  }
}

const CACHE_KEY = 'spotlight:query-cache';
const OWNER_KEY = 'spotlight:query-cache-owner';

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: async (key) => (await get<string>(key)) ?? null,
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
});

const shouldPersistQuery = (query: Query): boolean =>
  query.meta?.persist !== false && defaultShouldDehydrateQuery(query);

export const persistOptions = (
  buster: string,
): Omit<PersistQueryClientOptions, 'queryClient'> => ({
  persister,
  buster,
  maxAge: CACHE_MAX_AGE_MS,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
});

export const forgetQueryCache = async (): Promise<void> => {
  await persister.removeClient();
};

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

export const ownQueryCache = (userId: string): void => {
  rememberedOwner = userId;
  storeOwner(userId);
  for (const listener of ownerListeners) {
    listener();
  }
};
