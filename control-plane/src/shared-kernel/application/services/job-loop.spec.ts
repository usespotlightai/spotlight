import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { describe, expect, it, vi } from 'vitest';

const MAX_TRIES = 3;

class Item implements HasPendingJob<Item> {
  constructor(
    readonly attempts: number,
    readonly state: 'pending' | 'leased' | 'done' | 'dead-lettered',
    readonly lastTry: boolean,
    readonly spent = 0,
    readonly waitingSince: Date | null = null,
  ) {}

  get hasPendingJob(): boolean {
    return this.state === 'pending' || this.state === 'leased';
  }

  get jobExhausted(): boolean {
    return this.attempts >= MAX_TRIES;
  }

  leaseJob(): Item {
    return this.with(this.attempts + 1, 'leased');
  }

  scheduleRetry(): Item {
    return this.with(this.attempts, this.lastTry ? 'dead-lettered' : 'pending');
  }

  waitJob(now: Date): Item {
    return new Item(
      this.attempts - 1,
      'pending',
      this.lastTry,
      this.spent,
      now,
    );
  }

  deadLetter(): Item {
    return this.with(this.attempts, 'dead-lettered');
  }

  spending(more: number): Item {
    return new Item(this.attempts, this.state, this.lastTry, this.spent + more);
  }

  private with(attempts: number, state: Item['state']): Item {
    return new Item(attempts, state, this.lastTry, this.spent);
  }
}

const looping = (
  start: Item,
  processed: (item: Item, save: (item: Item) => void) => Promise<Item>,
) => {
  let stored = start;
  const save = (item: Item) => {
    stored = item;
  };
  const report = vi.fn();
  const error = vi.fn();
  const logger: LoggerPort = {
    debug: vi.fn(),
    info: vi.fn(),
    error,
    warn: vi.fn(),
  };
  const telemetry = telemetryInMemory();

  const loop = new JobLoop<Item, string>(
    {
      name: 'Judging runs',
      batchSize: 1,
      due: () => Promise.resolve(stored.state === 'pending' ? stored : null),
      find: () => Promise.resolve(stored),
      save: (item) => {
        stored = item;
        return Promise.resolve();
      },
      keyOf: () => 'item',
      ids: () => ({ workspaceId: 'workspace-1', runId: 'run-1' }),
      about: (item) => ({ attempts: item.attempts }),
      process: (item) => processed(item, save),
      stale: () => false,
    },
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => new Date(0), sleep: () => Promise.resolve() },
    logger,
    { report },
    telemetry,
  );

  return {
    async processOnce() {
      await loop.processDue();
      await loop.idle();
    },
    report,
    error,
    telemetry,
    stored: () => stored,
  };
};

describe('JobLoop', () => {
  it('schedules a retry on what a failed attempt saved, not on the job it started from', async () => {
    const loop = looping(new Item(0, 'pending', false), (item, save) => {
      save(item.spending(5));
      return Promise.reject(new Error('The code host did not answer.'));
    });

    await loop.processOnce();

    expect(loop.stored()).toMatchObject({ state: 'pending', spent: 5 });
  });

  it('processes each job in a span with the ids of the job', async () => {
    const loop = looping(new Item(0, 'pending', false), (item) =>
      Promise.resolve(item.scheduleRetry()),
    );

    await loop.processOnce();

    expect(loop.telemetry.started).toEqual([
      {
        name: 'Judging runs',
        ids: { workspaceId: 'workspace-1', runId: 'run-1' },
      },
    ]);
  });

  it('reports a job it dead-letters because it kept being interrupted, with its ids', async () => {
    const loop = looping(new Item(MAX_TRIES, 'pending', false), (item) =>
      Promise.resolve(item),
    );

    await loop.processOnce();

    expect(loop.stored().state).toBe('dead-lettered');
    expect(loop.report).toHaveBeenCalledExactlyOnceWith(
      new Error(
        'Judging runs: dead-lettered a job that kept being interrupted',
      ),
      {
        source: 'Judging runs',
        workspaceId: 'workspace-1',
        runId: 'run-1',
      },
    );
  });

  it('counts each outcome by source, without ids', async () => {
    const processed = looping(new Item(0, 'pending', false), (item) =>
      Promise.resolve(item.scheduleRetry()),
    );
    const failing = looping(new Item(0, 'pending', true), () =>
      Promise.reject(new Error('the model did not answer')),
    );

    await processed.processOnce();
    await failing.processOnce();

    expect(processed.telemetry.counted).toEqual([
      {
        metric: 'spotlight.jobs',
        attributes: {
          'spotlight.job.source': 'Judging runs',
          'spotlight.job.outcome': 'processed',
        },
      },
    ]);
    expect(failing.telemetry.counted).toEqual([
      {
        metric: 'spotlight.jobs',
        attributes: {
          'spotlight.job.source': 'Judging runs',
          'spotlight.job.outcome': 'dead_lettered',
        },
      },
    ]);
  });

  it('keeps a failure that it retries only in the logs', async () => {
    const failure = new Error('the model did not answer');
    const loop = looping(new Item(0, 'pending', false), () =>
      Promise.reject(failure),
    );

    await loop.processOnce();

    expect(loop.stored().state).toBe('pending');
    expect(loop.error).toHaveBeenCalledOnce();
    expect(loop.report).not.toHaveBeenCalled();
  });

  it('reports the failure that dead-letters the job', async () => {
    const failure = new Error('the model did not answer');
    const loop = looping(new Item(0, 'pending', true), () =>
      Promise.reject(failure),
    );

    await loop.processOnce();

    expect(loop.stored().state).toBe('dead-lettered');
    expect(loop.report).toHaveBeenCalledExactlyOnceWith(
      failure,
      expect.objectContaining({ source: 'Judging runs', runId: 'run-1' }),
    );
  });

  describe('while the job waits', () => {
    const waiting = (item: Item): Promise<Item> =>
      Promise.resolve(item.waitJob(new Date(0)));

    it('saves the job its process put back to wait, without counting the attempt or an error', async () => {
      const loop = looping(new Item(1, 'pending', false), waiting);

      await loop.processOnce();

      expect(loop.stored()).toMatchObject({
        state: 'pending',
        attempts: 1,
        waitingSince: new Date(0),
      });
      expect(loop.error).not.toHaveBeenCalled();
      expect(loop.report).not.toHaveBeenCalled();
      expect(loop.telemetry.counted).toEqual([
        {
          metric: 'spotlight.jobs',
          attributes: {
            'spotlight.job.source': 'Judging runs',
            'spotlight.job.outcome': 'processed',
          },
        },
      ]);
    });

    it('never runs out of attempts however often it waits', async () => {
      const loop = looping(new Item(0, 'pending', true), waiting);

      for (let round = 0; round <= MAX_TRIES; round += 1) {
        await loop.processOnce();
      }

      expect(loop.stored()).toMatchObject({ state: 'pending', attempts: 0 });
    });
  });
});
