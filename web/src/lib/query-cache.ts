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

// Bump when a query function changes the shape it returns.
const CACHE_SHAPE = 1;

const persister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: async (key) => (await get<string>(key)) ?? null,
    setItem: async (key, value) => set(key, value),
    removeItem: async (key) => del(key),
  },
});

const shouldPersistQuery = (query: Query): boolean =>
  query.meta?.persist !== false && defaultShouldDehydrateQuery(query);

export const persistOptions = (
  apiShape: string,
): Omit<PersistQueryClientOptions, 'queryClient'> => ({
  persister,
  buster: `${CACHE_SHAPE}-${apiShape}`,
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
  try {
    await persister.removeClient();
  } catch {
    return;
  }
};
