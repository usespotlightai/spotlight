import { QueryClient } from '@tanstack/react-query';
import type { PersistedQuery } from '@tanstack/react-query-persist-client';
import { describe, expect, it, vi } from 'vitest';

import {
  createStoredJournals,
  type JournalStorage,
} from '@/lib/stored-journals';

const HOUR = 60 * 60 * 1000;

const memoryStorage = (now: () => number) => {
  const items = new Map<string, PersistedQuery>();
  const savedAt = new Map<string, number>();
  const storage: JournalStorage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, structuredClone(value));
      savedAt.set(key, now());
    },
    removeItem: async (key) => {
      items.delete(key);
      savedAt.delete(key);
    },
    savedBefore: async (time) =>
      [...savedAt].filter(([, at]) => at < time).map(([key]) => key),
    newest: async (count) =>
      [...savedAt]
        .toSorted(([, a], [, b]) => b - a)
        .slice(0, count)
        .flatMap(([key]) => items.get(key) ?? []),
    clear: async () => {
      items.clear();
      savedAt.clear();
    },
  };

  return { storage, items };
};

const brokenStorage: JournalStorage = {
  getItem: () => {
    throw new ReferenceError('indexedDB is not defined');
  },
  setItem: () => Promise.reject(new Error('quota')),
  removeItem: () => Promise.reject(new Error('quota')),
  savedBefore: () => Promise.reject(new Error('closed')),
  newest: () => Promise.reject(new Error('closed')),
  clear: () => Promise.reject(new Error('closed')),
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const readJournal = (
  queryClient: QueryClient,
  persister: ReturnType<typeof createStoredJournals>['persister'],
  journal: () => Promise<string[]>,
  runId = 'run_1',
) => {
  queryClient.setQueryDefaults(['journal'], { persister });

  return queryClient.query({
    queryKey: ['journal', runId],
    queryFn: journal,
    staleTime: Number.POSITIVE_INFINITY,
  });
};

describe('stored journals', () => {
  it('shows a journal read before from storage, without asking the server', async () => {
    let time = 0;
    const now = () => time;
    const { storage } = memoryStorage(now);
    const stored = createStoredJournals(storage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
      now,
    });

    await readJournal(new QueryClient(), stored.persister, async () => [
      'step',
    ]);
    await settle();
    time = HOUR;

    const journal = vi.fn(async () => ['fresh step']);
    const data = await readJournal(
      new QueryClient(),
      stored.persister,
      journal,
    );

    expect(data).toEqual(['step']);
    expect(journal).not.toHaveBeenCalled();
  });

  it('asks the server when the journal was stored for another API', async () => {
    const { storage } = memoryStorage(() => 0);
    const before = createStoredJournals(storage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
    });
    await readJournal(new QueryClient(), before.persister, async () => [
      'step',
    ]);
    await settle();

    const after = createStoredJournals(storage, {
      buster: 'api_2',
      maxAge: 24 * HOUR,
    });
    const data = await readJournal(
      new QueryClient(),
      after.persister,
      async () => ['fresh step'],
    );

    expect(data).toEqual(['fresh step']);
  });

  it('removes journals stored longer ago than the maximum age', async () => {
    let time = 0;
    const now = () => time;
    const { storage, items } = memoryStorage(now);
    const stored = createStoredJournals(storage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
      now,
    });
    await readJournal(new QueryClient(), stored.persister, async () => [
      'step',
    ]);
    await settle();

    time = 23 * HOUR;
    await stored.prune();
    expect(items.size).toBe(1);

    time = 25 * HOUR;
    await stored.prune();
    expect(items.size).toBe(0);
  });

  it('forgets every stored journal', async () => {
    const { storage, items } = memoryStorage(() => 0);
    const stored = createStoredJournals(storage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
    });
    await readJournal(new QueryClient(), stored.persister, async () => [
      'step',
    ]);
    await settle();

    await stored.forget();

    expect(items.size).toBe(0);
  });

  it('asks the server when storage cannot be used', async () => {
    const stored = createStoredJournals(brokenStorage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
    });

    const data = await readJournal(
      new QueryClient(),
      stored.persister,
      async () => ['step'],
    );
    await settle();

    expect(data).toEqual(['step']);
    await expect(stored.prune()).resolves.toBeUndefined();
    await expect(stored.forget()).resolves.toBeUndefined();
    await expect(stored.recent(8)).resolves.toEqual([]);
  });

  it('gives the most recently saved journals first, up to the count asked for', async () => {
    let time = 0;
    const now = () => time;
    const { storage } = memoryStorage(now);
    const stored = createStoredJournals(storage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
      now,
    });

    for (const runId of ['run_1', 'run_2', 'run_3']) {
      time += HOUR;
      await readJournal(
        new QueryClient(),
        stored.persister,
        async () => [runId],
        runId,
      );
      await settle();
    }

    const recent = await stored.recent(2);

    expect(recent.map(({ queryKey }) => queryKey)).toEqual([
      ['journal', 'run_3'],
      ['journal', 'run_2'],
    ]);
  });

  it('leaves out recent journals stored for another API or too long ago', async () => {
    let shift = 0;
    const now = () => Date.now() + shift;
    const { storage } = memoryStorage(now);
    const before = createStoredJournals(storage, {
      buster: 'api_1',
      maxAge: 24 * HOUR,
      now,
    });
    await readJournal(new QueryClient(), before.persister, async () => [
      'step',
    ]);
    await settle();

    const otherApi = createStoredJournals(storage, {
      buster: 'api_2',
      maxAge: 24 * HOUR,
      now,
    });

    await expect(otherApi.recent(8)).resolves.toEqual([]);
    await expect(before.recent(8)).resolves.toHaveLength(1);

    shift = 25 * HOUR;

    await expect(before.recent(8)).resolves.toEqual([]);
  });
});
