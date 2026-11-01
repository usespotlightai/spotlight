import { EventDelivery, MAX_ATTEMPTS } from '@platform/events/event-delivery';
import type { EventOutbox } from '@platform/events/event-outbox';
import { EventSubscribers } from '@platform/events/event-subscribers';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import { subscribing } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-01T09:00:00.000Z');

const thenable = (result: unknown): unknown => {
  const chained: unknown = new Proxy(() => undefined, {
    get: (_target, key) =>
      key === 'then'
        ? (resolve: (value: unknown) => void) => resolve(result)
        : () => chained,
  });

  return chained;
};

class FakeContext {
  readonly steps: string[] = [];
  readonly updates: Record<string, unknown>[] = [];
  failingUpdates = 0;
  private committed: (() => void)[] = [];
  private claimable = true;

  constructor(private readonly attempts: number) {}

  get db(): unknown {
    return {
      select: () => {
        this.steps.push('claim');
        const due = this.claimable
          ? [
              {
                eventId: 'event_1',
                subscriber: 'test.door',
                attempts: this.attempts,
                kind: 'bell.rang',
                payload: {},
                cause: null,
                traceparent: null,
              },
            ]
          : [];
        this.claimable = false;

        return thenable(due);
      },
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            if (this.failingUpdates > 0) {
              this.failingUpdates -= 1;
              this.steps.push('update failed');
              throw new Error('connection terminated');
            }
            this.steps.push('update');
            this.updates.push(values);
          },
        }),
      }),
    };
  }

  async inTransaction<T>(work: () => Promise<T>): Promise<T> {
    this.steps.push('begin');
    this.committed = [];
    const result = await work();
    this.steps.push('commit');

    for (const each of this.committed) {
      each();
    }

    return result;
  }

  async inSavepoint<T>(work: () => Promise<T>): Promise<T> {
    this.steps.push('savepoint');

    try {
      const result = await work();
      this.steps.push('release savepoint');
      return result;
    } catch (error) {
      this.steps.push('rollback to savepoint');
      throw error;
    }
  }

  afterCommit(then: () => void): void {
    this.committed.push(then);
  }
}

const delivering = (handle: () => Promise<void>, attempts = 0) => {
  const context = new FakeContext(attempts);
  const subscribers = new EventSubscribers();
  subscribers.register([subscribing('test.door', ['bell.rang'], handle)]);
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(() => context.steps.push('logged')),
  };
  const reports = { report: vi.fn() };
  const delivery = new EventDelivery(
    context as unknown as DrizzleContext,
    {
      decode: (payload: unknown) => payload,
      record: async () => undefined,
    } as unknown as EventOutbox,
    subscribers,
    { now: () => NOW, sleep: async () => undefined },
    logger,
    { runWith: (_chain, work) => work() } as CausationPort,
    reports,
    {
      inSpan: <T>(
        _name: string,
        _attributes: unknown,
        work: () => Promise<T>,
      ) => work(),
      count: () => undefined,
    } as unknown as TelemetryPort,
  );

  return { delivery, context, logger, reports };
};

describe('EventDelivery', () => {
  it('records a delivery in the transaction that claimed it, after the subscriber handled it in a savepoint', async () => {
    const { delivery, context } = delivering(async () => undefined);

    expect(await delivery.processDue()).toBe(1);
    expect(context.steps.slice(0, 6)).toEqual([
      'begin',
      'claim',
      'savepoint',
      'release savepoint',
      'update',
      'commit',
    ]);
    expect(context.updates).toEqual([{ deliveredAt: NOW, attempts: 1 }]);
  });

  it('records a failed delivery and its backoff in the transaction that claimed it, so no other control plane takes it before', async () => {
    const { delivery, context } = delivering(async () => {
      throw new Error('nobody home');
    }, 2);

    expect(await delivery.processDue()).toBe(1);
    expect(context.steps.slice(0, 7)).toEqual([
      'begin',
      'claim',
      'savepoint',
      'rollback to savepoint',
      'update',
      'commit',
      'logged',
    ]);
    expect(context.updates).toEqual([
      {
        attempts: 3,
        lastError: 'nobody home',
        dueAt: new Date(NOW.getTime() + 8000),
        deadLetteredAt: null,
      },
    ]);
  });

  it('records and logs the subscriber’s failure, not the database’s, when writing it in the claiming transaction fails', async () => {
    const { delivery, context, logger } = delivering(async () => {
      throw new Error('nobody home');
    });
    context.failingUpdates = 1;

    await delivery.processDue();

    expect(context.updates).toEqual([
      expect.objectContaining({ attempts: 1, lastError: 'nobody home' }),
    ]);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ err: new Error('nobody home'), attempts: 1 }),
      'Delivering a domain event',
    );
  });

  it('logs the subscriber’s failure even when no transaction can record it', async () => {
    const { delivery, context, logger } = delivering(async () => {
      throw new Error('nobody home');
    });
    context.failingUpdates = 2;

    await expect(delivery.processDue()).rejects.toThrow(
      'connection terminated',
    );
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ err: new Error('nobody home') }),
      'Delivering a domain event',
    );
  });

  it('dead-letters the delivery in the same transaction on the last attempt, and reports it once it committed', async () => {
    const { delivery, context, reports } = delivering(async () => {
      throw new Error('nobody home');
    }, MAX_ATTEMPTS - 1);

    await delivery.processDue();

    expect(context.updates).toEqual([
      expect.objectContaining({
        attempts: MAX_ATTEMPTS,
        deadLetteredAt: NOW,
      }),
    ]);
    expect(reports.report).toHaveBeenCalledExactlyOnceWith(
      new Error('nobody home'),
      { source: 'test.door' },
    );
  });
});
