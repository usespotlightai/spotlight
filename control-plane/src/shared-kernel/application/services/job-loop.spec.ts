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
  ) {}

  get hasPendingJob(): boolean {
    return this.state === 'pending' || this.state === 'leased';
  }

  get jobExhausted(): boolean {
    return this.attempts >= MAX_TRIES;
  }

  leaseJob(): Item {
    return new Item(this.attempts + 1, 'leased', this.lastTry);
  }

  scheduleRetry(): Item {
    return new Item(
      this.attempts,
      this.lastTry ? 'dead-lettered' : 'pending',
      this.lastTry,
    );
  }

  deadLetter(): Item {
    return new Item(this.attempts, 'dead-lettered', this.lastTry);
  }
}

const looping = (start: Item, processed: (item: Item) => Promise<Item>) => {
  let stored = start;
  const report = vi.fn();
  const error = vi.fn();
  const logger = { error, warn: vi.fn() } as unknown as LoggerPort;
  const telemetry = telemetryInMemory();

  const loop = new JobLoop<Item, string>(
    {
      name: 'Judging runs',
      batchSize: 1,
      due: async () => (stored.state === 'pending' ? stored : null),
      find: async () => stored,
      save: async (item) => {
        stored = item;
      },
      keyOf: () => 'item',
      ids: () => ({ workspaceId: 'workspace-1', runId: 'run-1' }),
      about: (item) => ({ attempts: item.attempts }),
      process: processed,
      stale: () => false,
    },
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => new Date(0), sleep: async () => undefined },
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
  it('processes each job in a span with the ids of the job', async () => {
    const loop = looping(new Item(0, 'pending', false), async (item) =>
      item.scheduleRetry(),
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
    const loop = looping(
      new Item(MAX_TRIES, 'pending', false),
      async (item) => item,
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
    const processed = looping(new Item(0, 'pending', false), async (item) =>
      item.scheduleRetry(),
    );
    const failing = looping(new Item(0, 'pending', true), async () => {
      throw new Error('the model did not answer');
    });

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
    const loop = looping(new Item(0, 'pending', false), async () => {
      throw failure;
    });

    await loop.processOnce();

    expect(loop.stored().state).toBe('pending');
    expect(loop.error).toHaveBeenCalledOnce();
    expect(loop.report).not.toHaveBeenCalled();
  });

  it('reports the failure that dead-letters the job', async () => {
    const failure = new Error('the model did not answer');
    const loop = looping(new Item(0, 'pending', true), async () => {
      throw failure;
    });

    await loop.processOnce();

    expect(loop.stored().state).toBe('dead-lettered');
    expect(loop.report).toHaveBeenCalledExactlyOnceWith(
      failure,
      expect.objectContaining({ source: 'Judging runs', runId: 'run-1' }),
    );
  });
});
