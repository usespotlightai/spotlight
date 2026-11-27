import {
  type AsyncStorage,
  experimental_createQueryPersister,
  type PersistedQuery,
} from '@tanstack/react-query-persist-client';
import {
  clear,
  createStore,
  del,
  entries,
  get,
  getMany,
  set,
} from 'idb-keyval';

export interface JournalStorage extends AsyncStorage<PersistedQuery> {
  removeItem: (key: string) => Promise<void>;
  savedBefore: (time: number) => Promise<string[]>;
  newest: (count: number) => Promise<PersistedQuery[]>;
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
    newest: async (count) => {
      const keys = (await entries<string, number>(savedAt))
        .toSorted(([, a], [, b]) => b - a)
        .slice(0, count)
        .map(([key]) => key);
      const queries = await getMany<PersistedQuery | undefined>(keys, journals);
      return queries.filter((query) => query !== undefined);
    },
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
  newest: async (count) => {
    try {
      return await storage.newest(count);
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

export type StoredJournals = {
  readonly persister: ReturnType<
    typeof experimental_createQueryPersister<PersistedQuery>
  >['persisterFn'];
  readonly recent: (count: number) => Promise<PersistedQuery[]>;
  readonly prune: () => Promise<void>;
  readonly forget: () => Promise<void>;
};

export const createStoredJournals = (
  storage: JournalStorage,
  { buster, maxAge, now = Date.now }: StoredJournalOptions,
): StoredJournals => {
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
    recent: async (count: number): Promise<PersistedQuery[]> =>
      (await safe.newest(count)).filter(
        (query) =>
          query.buster === buster &&
          now() - query.state.dataUpdatedAt <= maxAge,
      ),
    prune: async (): Promise<void> => {
      const old = await safe.savedBefore(now() - maxAge);
      await Promise.all(old.map((key) => safe.removeItem(key)));
    },
    forget: (): Promise<void> => safe.clear(),
  };
};
