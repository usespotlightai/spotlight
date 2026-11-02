import {
  EventDelivery,
  LEASE_MS,
  LEASE_RENEWAL_MS,
  LONGEST_LEASE_MS,
  MAX_ATTEMPTS,
} from '@platform/events/event-delivery';
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

const datesIn = (node: unknown, seen = new Set<unknown>()): Date[] => {
  if (node instanceof Date) {
    return [node];
  }

  if (typeof node !== 'object' || node === null || seen.has(node)) {
    return [];
  }

  seen.add(node);

  return Object.values(node).flatMap((each) => datesIn(each, seen));
};

class FakeContext {
  readonly steps: string[] = [];
  readonly updates: Record<string, unknown>[] = [];
  failingUpdates = 0;
  failingUpdateAt: number | null = null;
  readonly leasesGuarded: Date[] = [];
  settledElsewhere = false;
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
          where: (condition: unknown) => {
            this.leasesGuarded.push(...datesIn(condition));
            const written = async () => {
              if (this.failingUpdateAt === this.updates.length) {
                this.failingUpdateAt = null;
                this.steps.push('update failed');
                throw new Error('connection terminated');
              }
              if (this.failingUpdates > 0) {
                this.failingUpdates -= 1;
                this.steps.push('update failed');
                throw new Error('connection terminated');
              }
              if (this.settledElsewhere && this.updates.length > 0) {
                this.steps.push('update matched nothing');
                return [];
              }
              this.steps.push('update');
              this.updates.push(values);
              return [{ eventId: 'event_1' }];
            };

            const rows = written();

            return Object.assign(rows, { returning: () => rows });
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

const delivering = (
  handle: () => Promise<void>,
  attempts = 0,
  options = { callsOut: false },
  clock = { now: () => NOW },
) => {
  const context = new FakeContext(attempts);
  const subscribers = new EventSubscribers();
  subscribers.register([
    subscribing('test.door', ['bell.rang'], handle, options),
  ]);
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(() => context.steps.push('logged')),
  };
  const reports = { report: vi.fn() };
  const telemetry = {
    inSpan: <T>(_name: string, _attributes: unknown, work: () => Promise<T>) =>
      work(),
    count: vi.fn(),
  };
  const delivery = new EventDelivery(
    context as unknown as DrizzleContext,
    {
      decode: (payload: unknown) => payload,
      record: async () => undefined,
    } as unknown as EventOutbox,
    subscribers,
    { now: () => clock.now(), sleep: async () => undefined },
    logger,
    { runWith: (_chain, work) => work() } as CausationPort,
    reports,
    telemetry as unknown as TelemetryPort,
  );

  return { delivery, context, logger, reports, telemetry };
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

  it('counts and reports nothing when another instance settled the delivery before the fallback wrote it', async () => {
    const { delivery, context, logger, reports, telemetry } = delivering(
      async () => {
        throw new Error('nobody home');
      },
      MAX_ATTEMPTS - 1,
    );
    context.failingUpdates = 1;
    context.settledElsewhere = true;
    context.updates.push({ deliveredAt: NOW });

    await delivery.processDue();

    expect(logger.error).not.toHaveBeenCalled();
    expect(reports.report).not.toHaveBeenCalled();
    expect(telemetry.count).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ err: new Error('nobody home') }),
      'Another instance settled this domain event delivery first',
    );
  });

  describe('to a subscriber that calls out', () => {
    const CALLS_OUT = { callsOut: true };
    const LEASED = { dueAt: new Date(NOW.getTime() + LEASE_MS) };

    it('leases the delivery in a transaction of its own, calls out with none open, and records it in another', async () => {
      const { delivery, context, telemetry } = delivering(
        async () => {
          context.steps.push('called out');
        },
        0,
        CALLS_OUT,
      );

      expect(await delivery.processDue()).toBe(1);
      expect(context.steps.slice(0, 8)).toEqual([
        'begin',
        'claim',
        'update',
        'commit',
        'called out',
        'begin',
        'update',
        'commit',
      ]);
      expect(context.updates).toEqual([
        LEASED,
        { deliveredAt: NOW, attempts: 1 },
      ]);
      expect(telemetry.count).toHaveBeenCalledWith(
        'spotlight.outbox.deliveries',
        expect.objectContaining({ 'spotlight.delivery.outcome': 'delivered' }),
      );
    });

    it('renews the lease while the call takes longer, and records it under the renewed lease', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      let now = NOW;
      const later = new Date(NOW.getTime() + LEASE_RENEWAL_MS);
      const { delivery, context } = delivering(
        async () => {
          now = later;
          await vi.advanceTimersByTimeAsync(LEASE_RENEWAL_MS);
        },
        0,
        CALLS_OUT,
        { now: () => now },
      );

      await delivery.processDue();
      vi.useRealTimers();

      expect(context.updates).toEqual([
        LEASED,
        { dueAt: new Date(later.getTime() + LEASE_MS) },
        { deliveredAt: later, attempts: 1 },
      ]);
      expect(context.leasesGuarded).toEqual([
        LEASED.dueAt,
        new Date(later.getTime() + LEASE_MS),
      ]);
    });

    it('stops renewing a lease it has held for the longest a lease is held', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      let now = NOW;
      const { delivery, context } = delivering(
        async () => {
          now = new Date(NOW.getTime() + LONGEST_LEASE_MS);
          await vi.advanceTimersByTimeAsync(3 * LEASE_RENEWAL_MS);
        },
        0,
        CALLS_OUT,
        { now: () => now },
      );

      await delivery.processDue();
      vi.useRealTimers();

      expect(
        context.updates.filter(
          (each) => 'dueAt' in each && !('attempts' in each),
        ),
      ).toEqual([LEASED]);
    });

    it('records a failed call and its backoff once it failed', async () => {
      const { delivery, context, logger } = delivering(
        async () => {
          throw new Error('nobody home');
        },
        2,
        CALLS_OUT,
      );

      await delivery.processDue();

      expect(context.updates).toEqual([
        LEASED,
        {
          attempts: 3,
          lastError: 'nobody home',
          dueAt: new Date(NOW.getTime() + 8000),
          deadLetteredAt: null,
        },
      ]);
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ err: new Error('nobody home'), attempts: 3 }),
        'Delivering a domain event',
      );
    });

    it('dead-letters a call that fails on the last attempt, and reports it', async () => {
      const { delivery, reports } = delivering(
        async () => {
          throw new Error('nobody home');
        },
        MAX_ATTEMPTS - 1,
        CALLS_OUT,
      );

      await delivery.processDue();

      expect(reports.report).toHaveBeenCalledExactlyOnceWith(
        new Error('nobody home'),
        { source: 'test.door' },
      );
    });

    it('counts and reports nothing where another instance took the delivery over', async () => {
      const { delivery, context, logger, reports, telemetry } = delivering(
        async () => undefined,
        0,
        CALLS_OUT,
      );
      context.settledElsewhere = true;

      await delivery.processDue();

      expect(context.updates).toEqual([LEASED]);
      expect(reports.report).not.toHaveBeenCalled();
      expect(telemetry.count).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ eventId: 'event_1' }),
        'Another instance took over this domain event delivery after its lease ended',
      );
    });

    it('does not count a call that worked as failed when recording it fails, and leaves it to its lease', async () => {
      const { delivery, context, logger, reports } = delivering(
        async () => undefined,
        MAX_ATTEMPTS - 1,
        CALLS_OUT,
      );
      context.failingUpdateAt = 1;

      await delivery.processDue();

      expect(context.updates).toEqual([LEASED]);
      expect(reports.report).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ err: new Error('connection terminated') }),
        'Recording a handled domain event delivery; it is retried once its lease ends',
      );
    });
  });
});
