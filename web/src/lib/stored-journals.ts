import {
  type AsyncStorage,
  experimental_createQueryPersister,
  type PersistedQuery,
} from '@tanstack/react-query-persist-client';
import { clear, createStore, del, entries, get, set } from 'idb-keyval';

export interface JournalStorage extends AsyncStorage<PersistedQuery> {
  removeItem: (key: string) => Promise<void>;
  savedBefore: (time: number) => Promise<string[]>;
  clear: () => Promise<void>;
}

interface StoredJournalOptions {
  readonly buster: string;
  readonly maxAge: number;
  readonly now?: () => number;
}

export const indexedJournalStorage = (
  now: () => number = Date.now,
): JournalStorage => {
  const journals = createStore('spotlight-journals', 'journals');
  const savedAt = createStore('spotlight-journals-saved-at', 'saved-at');

  return {
    getItem: (key) => get<PersistedQuery>(key, journals),
    setItem: async (key, value) => {
      await set(key, value, journals);
      await set(key, now(), savedAt);
    },
    removeItem: async (key) => {
      await Promise.all([del(key, journals), del(key, savedAt)]);
    },
    savedBefore: async (time) =>
      (await entries<string, number>(savedAt))
        .filter(([, at]) => at < time)
        .map(([key]) => key),
    clear: async () => {
      await Promise.all([clear(journals), clear(savedAt)]);
    },
  };
};

const failSafe = (storage: JournalStorage): JournalStorage => ({
  getItem: async (key) => {
    try {
      return await storage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await storage.setItem(key, value);
    } catch {
      return;
    }
  },
  removeItem: async (key) => {
    try {
      await storage.removeItem(key);
    } catch {
      return;
    }
  },
  savedBefore: async (time) => {
    try {
      return await storage.savedBefore(time);
    } catch {
      return [];
    }
  },
  clear: async () => {
    try {
      await storage.clear();
    } catch {
      return;
    }
  },
});

const cloneable = (query: PersistedQuery): PersistedQuery => ({
  ...query,
  state: { ...query.state, error: null, fetchFailureReason: null },
});

export const createStoredJournals = (
  storage: JournalStorage,
  { buster, maxAge, now = Date.now }: StoredJournalOptions,
) => {
  const safe = failSafe(storage);
  const { persisterFn } = experimental_createQueryPersister<PersistedQuery>({
    storage: safe,
    buster,
    maxAge,
    serialize: cloneable,
    deserialize: (query) => query,
    prefix: 'journal',
  });

  return {
    persister: persisterFn,
    prune: async () => {
      const old = await safe.savedBefore(now() - maxAge);
      await Promise.all(old.map((key) => safe.removeItem(key)));
    },
    forget: () => safe.clear(),
  };
};
