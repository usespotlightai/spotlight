import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { OwedWorkPool } from '@shared-kernel/application/services/owed-work-pool';
import type { OwesWork } from '@shared-kernel/domain/owes-work';
import { describe, expect, it, vi } from 'vitest';

const MAX_TRIES = 3;

class Item implements OwesWork<Item> {
  constructor(
    readonly attempts: number,
    readonly state: 'owed' | 'leased' | 'done' | 'given-up',
    readonly lastTry: boolean,
  ) {}

  get owesWork(): boolean {
    return this.state === 'owed' || this.state === 'leased';
  }

  get workExhausted(): boolean {
    return this.attempts >= MAX_TRIES;
  }

  leased(): Item {
    return new Item(this.attempts + 1, 'leased', this.lastTry);
  }

  triedAgainLater(): Item {
    return new Item(
      this.attempts,
      this.lastTry ? 'given-up' : 'owed',
      this.lastTry,
    );
  }

  gaveUp(): Item {
    return new Item(this.attempts, 'given-up', this.lastTry);
  }
}

const working = (start: Item, worked: (item: Item) => Promise<Item>) => {
  let stored = start;
  const report = vi.fn();
  const error = vi.fn();
  const logger = { error, warn: vi.fn() } as unknown as LoggerPort;

  const pool = new OwedWorkPool<Item, string>(
    {
      name: 'Judging runs',
      maxAtOnce: 1,
      due: async () => (stored.state === 'owed' ? stored : null),
      find: async () => stored,
      save: async (item) => {
        stored = item;
      },
      keyOf: () => 'item',
      ids: () => ({ workspaceId: 'workspace-1', runId: 'run-1' }),
      about: (item) => ({ attempts: item.attempts }),
      worked,
      stale: () => false,
    },
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => new Date(0), sleep: async () => undefined },
    logger,
    { report },
  );

  return {
    async workOnce() {
      await pool.workDue();
      await pool.idle();
    },
    report,
    error,
    stored: () => stored,
  };
};

describe('OwedWorkPool', () => {
  it('reports work it gives up because it kept being interrupted, with its ids', async () => {
    const pool = working(
      new Item(MAX_TRIES, 'owed', false),
      async (item) => item,
    );

    await pool.workOnce();

    expect(pool.stored().state).toBe('given-up');
    expect(pool.report).toHaveBeenCalledExactlyOnceWith(
      new Error('Judging runs: gave up on work that kept being interrupted'),
      {
        source: 'Judging runs',
        workspaceId: 'workspace-1',
        runId: 'run-1',
      },
    );
  });

  it('keeps a failure it tries again only in the logs', async () => {
    const failure = new Error('the model did not answer');
    const pool = working(new Item(0, 'owed', false), async () => {
      throw failure;
    });

    await pool.workOnce();

    expect(pool.stored().state).toBe('owed');
    expect(pool.error).toHaveBeenCalledOnce();
    expect(pool.report).not.toHaveBeenCalled();
  });

  it('reports the failure that ends the work', async () => {
    const failure = new Error('the model did not answer');
    const pool = working(new Item(0, 'owed', true), async () => {
      throw failure;
    });

    await pool.workOnce();

    expect(pool.stored().state).toBe('given-up');
    expect(pool.report).toHaveBeenCalledExactlyOnceWith(
      failure,
      expect.objectContaining({ source: 'Judging runs', runId: 'run-1' }),
    );
  });
});
