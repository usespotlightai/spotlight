import { Inject, Injectable } from '@nestjs/common';
import { CauseCarrier } from '@platform/events/cause-carrier';
import { idsOf } from '@platform/events/event-ids';
import { EventOutbox } from '@platform/events/event-outbox';
import {
  DELIVERY_LANES,
  type DeliveryLane,
  EventSubscribers,
} from '@platform/events/event-subscribers';
import { heardDeliveries } from '@platform/events/heard-deliveries';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { traceIdOfTraceparent } from '@platform/telemetry/trace-context';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ERROR_REPORTS,
  type ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  gt,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';

// A subscriber that sets no retry gets 8 attempts. The outbox waits 2 seconds after the first attempt, twice as long after each next one, and never longer than one hour.
export const DEFAULT_RETRY = Retry.backoff({
  maxAttempts: 8,
  initialDelayMs: 2_000,
  maxDelayMs: 60 * 60 * 1000,
});

export const LEASE_MS = 5 * 60 * 1000;

export const LEASE_RENEWAL_MS = 60 * 1000;

export const LONGEST_LEASE_MS = 30 * 60 * 1000;

const DELIVERIES_METRIC = 'spotlight.outbox.deliveries';

// How many deliveries one processDue call works at most.
const DELIVERY_BATCH = 100;

const REDELIVERY_PAGE = 1_000;

// How many dead letters one redelivery queues again when it names no limit, and at most. A small default keeps the new events of the webhook from waiting behind a large batch; the caller asks again while the redelivery is truncated.
export const REDELIVERY_LIMIT = 1_000;

export const MAX_REDELIVERY_LIMIT = 100_000;

export interface Redelivery {
  readonly queued: number;
  // The redelivery stopped at its limit, and more dead letters may wait.
  readonly truncated: boolean;
}

// A delivery untouched since the time: no attempt, dead letter, lease or redelivery since then. Each of them sets its due time, so a dead letter's due time is when it became one.
export const untouchedSince = (before: Date): SQL =>
  sql`${eventDelivery.dueAt} < ${before.toISOString()}::timestamptz`;

// Locks the deliveries that match, always in the order of their event and subscriber, so two instances that lock deliveries never wait on each other in a circle.
export const lockDeliveries = async (
  db: DrizzleDatabase,
  where: SQL,
): Promise<void> => {
  await db
    .select({ eventId: eventDelivery.eventId })
    .from(eventDelivery)
    .where(where)
    .orderBy(asc(eventDelivery.eventId), asc(eventDelivery.subscriber))
    .for('update');
};

const because = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replaceAll(
    '\u0000',
    '',
  );

type Outcome = 'delivered' | 'retried' | 'dead_lettered' | 'lost';

type Claim =
  | { readonly kind: 'none' }
  | { readonly kind: 'settled' }
  | { readonly kind: 'leased'; readonly due: Due; readonly lease: Date };

interface Lease {
  current: Date;
  readonly until: Date;
  renewing: Promise<void>;
  readonly timer: ReturnType<typeof setInterval>;
}

interface Due {
  readonly eventId: string;
  readonly subscriber: string;
  readonly attempts: number;
  readonly kind: string;
  readonly payload: unknown;
  readonly cause: unknown;
  readonly traceparent: string | null;
  readonly recordedAt: Date;
}

@Injectable()
export class EventDelivery {
  constructor(
    private readonly context: DrizzleContext,
    private readonly outbox: EventOutbox,
    private readonly subscribers: EventSubscribers,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(LOGGER) private readonly logger: LoggerPort,
    private readonly causes: CauseCarrier,
    @Inject(ERROR_REPORTS) private readonly reports: ErrorReportsPort,
    @Inject(TELEMETRY) private readonly telemetry: TelemetryPort,
  ) {}

  // Works the due deliveries of the lane, but only those that this instance hears: a subscriber it registers, and a kind that subscriber hears. During a deploy, an instance never settles a delivery that only a newer instance can handle. A delivery that no instance hears stays as it is, and retention deletes it once it has been untouched for the retention age.
  async processDue(
    lane: DeliveryLane,
    limit = DELIVERY_BATCH,
  ): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.deliverOne(lane))) {
      worked += 1;
    }

    return worked;
  }

  async drain(timeoutMs = 10_000): Promise<void> {
    const until = Date.now() + timeoutMs;

    for (;;) {
      for (const lane of DELIVERY_LANES) {
        await this.processDue(lane);
      }

      if ((await this.stillDue()) === 0 || Date.now() > until) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  // Queues the dead letters of one subscriber again, for the events recorded at or after the time whose kind it still hears, at most limit of them. Each gets all its attempts again. While the result is truncated, a next call queues more.
  async redeliver(
    subscriber: string,
    since: Date,
    limit = REDELIVERY_LIMIT,
  ): Promise<Redelivery> {
    const db = this.context.db;
    let after: string | null = null;
    let queued = 0;
    let skipped = 0;
    let truncated = false;

    for (;;) {
      const dead = await db
        .select({ eventId: eventDelivery.eventId, kind: eventOutbox.kind })
        .from(eventDelivery)
        .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
        .where(
          and(
            eq(eventDelivery.subscriber, subscriber),
            isNull(eventDelivery.deliveredAt),
            isNotNull(eventDelivery.deadLetteredAt),
            gte(eventOutbox.recordedAt, since),
            after ? gt(eventDelivery.eventId, after) : undefined,
          ),
        )
        .orderBy(asc(eventDelivery.eventId))
        .limit(REDELIVERY_PAGE);
      const heard = dead
        .filter((each) => this.subscribers.hears(subscriber, each.kind))
        .map((each) => each.eventId);
      const taken = heard.slice(0, limit - queued);

      skipped += dead.length - heard.length;

      if (taken.length > 0) {
        queued += await this.requeue(subscriber, taken);
      }

      if (queued >= limit) {
        truncated =
          taken.length < heard.length || dead.length === REDELIVERY_PAGE;
        break;
      }

      if (dead.length < REDELIVERY_PAGE) {
        break;
      }

      after = dead[dead.length - 1]?.eventId ?? null;
    }

    this.logger.info(
      { subscriber, since: since.toISOString(), queued, skipped, truncated },
      'Queued dead letters again',
    );

    return { queued, truncated };
  }

  // Locks the dead letters and queues them again. A row that retention deleted in the meantime is not written, so it is not counted.
  private requeue(
    subscriber: string,
    eventIds: readonly string[],
  ): Promise<number> {
    return this.context.inTransaction(async () => {
      const db = this.context.db;
      // and() gives undefined only with no conditions, so the false never applies. lockDeliveries needs a filter.
      const dead =
        and(
          eq(eventDelivery.subscriber, subscriber),
          isNull(eventDelivery.deliveredAt),
          isNotNull(eventDelivery.deadLetteredAt),
          inArray(eventDelivery.eventId, [...eventIds]),
        ) ?? sql`false`;

      await lockDeliveries(db, dead);

      const written = await db
        .update(eventDelivery)
        .set({ attempts: 0, deadLetteredAt: null, dueAt: this.clock.now() })
        .where(dead)
        .returning({ eventId: eventDelivery.eventId });

      return written.length;
    });
  }

  private async stillDue(): Promise<number> {
    const [row] = await this.context.db
      .select({ due: count() })
      .from(eventDelivery)
      .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
      .where(
        and(
          heardDeliveries(
            DELIVERY_LANES.flatMap((lane) => this.subscribers.lane(lane)),
          ),
          isNull(eventDelivery.deliveredAt),
          isNull(eventDelivery.deadLetteredAt),
          lte(eventDelivery.dueAt, this.clock.now()),
        ),
      );

    return row?.due ?? 0;
  }

  private async deliverOne(lane: DeliveryLane): Promise<boolean> {
    const claim = await this.claimNext(lane);

    if (claim.kind === 'leased') {
      await this.deliverLeased(claim.due, claim.lease);
    }

    return claim.kind !== 'none';
  }

  private async claimNext(lane: DeliveryLane): Promise<Claim> {
    const claimed: { due: Due | null; failure: { error: unknown } | null } = {
      due: null,
      failure: null,
    };

    try {
      const outcome = await this.context.inTransaction(async () => {
        const due = await this.nextDue(lane);
        claimed.due = due;

        if (!due) {
          return null;
        }

        if (this.subscribers.named(due.subscriber)?.callsOut) {
          return { due, lease: await this.leased(due) };
        }

        try {
          await this.context.inSavepoint(() =>
            this.handled(due, async (raised) => this.outbox.record(raised)),
          );
        } catch (error) {
          claimed.failure = { error };
          const failed = await this.failed(due, error);
          this.context.afterCommit(() => this.reported(due, error));

          return failed;
        }

        await this.context.db
          .update(eventDelivery)
          .set({ deliveredAt: this.clock.now(), attempts: due.attempts + 1 })
          .where(this.at(due));

        return 'delivered' as const;
      });

      if (outcome === null) {
        return { kind: 'none' };
      }

      if (typeof outcome === 'object') {
        return { kind: 'leased', ...outcome };
      }

      if (outcome !== 'lost' && claimed.due) {
        this.counted(claimed.due, outcome);
      }

      return { kind: 'settled' };
    } catch (error) {
      const due = claimed.due;

      if (!due) {
        throw error;
      }

      const failure = claimed.failure ? claimed.failure.error : error;
      const outcome = await this.context
        .inTransaction(() => this.failed(due, failure))
        .catch((written: unknown) => {
          this.reported(due, failure);
          throw written;
        });

      if (outcome === 'lost') {
        this.lost(due, failure);
        return { kind: 'settled' };
      }

      this.reported(due, failure);
      this.counted(due, outcome);
      return { kind: 'settled' };
    }
  }

  private async leased(due: Due): Promise<Date> {
    const lease = new Date(this.clock.now().getTime() + LEASE_MS);

    await this.context.db
      .update(eventDelivery)
      .set({ dueAt: lease })
      .where(this.at(due));

    return lease;
  }

  private async deliverLeased(due: Due, lease: Date): Promise<void> {
    const held = this.renewing(due, lease);
    let outcome: Outcome;

    try {
      const settling = await this.handled(due, async (raised) => {
        const current = await this.released(held);

        return this.context
          .inTransaction(() => this.settled(due, current, raised))
          .catch((error: unknown) => ({ unsettled: error, current }));
      });

      if (typeof settling === 'object') {
        await this.unsettled(due, settling.unsettled, settling.current);
        return;
      }

      outcome = settling;
    } catch (error) {
      const current = await this.released(held);

      outcome = await this.context
        .inTransaction(() => this.failed(due, error, current))
        .catch((written: unknown) => {
          this.reported(due, error);
          throw written;
        });

      if (outcome === 'lost') {
        this.leaseLost(due, error);
        return;
      }

      this.reported(due, error);
    }

    if (outcome === 'lost') {
      this.leaseLost(due);
      return;
    }

    this.counted(due, outcome);
  }

  private renewing(due: Due, lease: Date): Lease {
    const held: Lease = {
      current: lease,
      until: new Date(this.clock.now().getTime() + LONGEST_LEASE_MS),
      renewing: Promise.resolve(),
      timer: setInterval(() => {
        held.renewing = held.renewing.then(() => this.renewed(due, held));
      }, LEASE_RENEWAL_MS),
    };

    return held;
  }

  private async renewed(due: Due, held: Lease): Promise<void> {
    const next = new Date(this.clock.now().getTime() + LEASE_MS);

    if (next > held.until) {
      clearInterval(held.timer);
      return;
    }

    try {
      const written = await this.context.db
        .update(eventDelivery)
        .set({ dueAt: next })
        .where(this.open(due, held.current))
        .returning({ eventId: eventDelivery.eventId });

      if (written.length > 0) {
        held.current = next;
      } else {
        clearInterval(held.timer);
      }
    } catch (error) {
      const ending =
        held.current.getTime() - this.clock.now().getTime() <= LEASE_RENEWAL_MS;
      const log = {
        err: error,
        eventId: due.eventId,
        subscriber: due.subscriber,
        ...idsOf(due.payload),
      };

      if (ending) {
        this.logger.error(
          log,
          'Renewing the lease of a domain event delivery; another instance may take it over while it still runs',
        );
      } else {
        this.logger.warn(log, 'Renewing the lease of a domain event delivery');
      }
    }
  }

  private async released(held: Lease): Promise<Date> {
    clearInterval(held.timer);
    await held.renewing;

    return held.current;
  }

  private async settled(
    due: Due,
    lease: Date,
    raised: readonly DomainEvent[],
  ): Promise<'delivered' | 'lost'> {
    const written = await this.context.db
      .update(eventDelivery)
      .set({ deliveredAt: this.clock.now(), attempts: due.attempts + 1 })
      .where(this.open(due, lease))
      .returning({ eventId: eventDelivery.eventId });

    if (written.length === 0) {
      return 'lost';
    }

    await this.outbox.record(raised);

    return 'delivered';
  }

  private async unsettled(
    due: Due,
    error: unknown,
    lease: Date,
  ): Promise<void> {
    const outcome = await this.context
      .inTransaction(() => this.failed(due, error, lease))
      .catch(() => null);

    this.logger.error(
      {
        err: error,
        eventId: due.eventId,
        eventKind: due.kind,
        subscriber: due.subscriber,
        attempts: due.attempts + 1,
        ...idsOf(due.payload),
      },
      outcome === null
        ? 'Recording a handled domain event delivery; it is retried once its lease ends'
        : 'Recording a handled domain event delivery',
    );

    if (outcome === null) {
      return;
    }

    if (outcome === 'lost') {
      this.leaseLost(due, error);
      return;
    }

    if (outcome === 'dead_lettered') {
      this.reports.report(error, {
        source: due.subscriber,
        ...idsOf(due.payload),
      });
    }

    this.counted(due, outcome);
  }

  private leaseLost(due: Due, error?: unknown): void {
    this.logger.warn(
      {
        err: error,
        eventId: due.eventId,
        subscriber: due.subscriber,
        ...idsOf(due.payload),
      },
      'Another instance took over this domain event delivery after its lease ended',
    );
  }

  private lost(due: Due, error: unknown): void {
    this.logger.warn(
      {
        err: error,
        eventId: due.eventId,
        subscriber: due.subscriber,
        ...idsOf(due.payload),
      },
      'Another instance settled this domain event delivery first',
    );
  }

  private async nextDue(lane: DeliveryLane): Promise<Due | null> {
    const hearings = this.subscribers.lane(lane);

    if (hearings.length === 0) {
      return null;
    }

    const [row] = await this.context.db
      .select({
        eventId: eventDelivery.eventId,
        subscriber: eventDelivery.subscriber,
        attempts: eventDelivery.attempts,
        kind: eventOutbox.kind,
        payload: eventOutbox.payload,
        cause: eventOutbox.cause,
        traceparent: eventOutbox.traceparent,
        recordedAt: eventOutbox.recordedAt,
      })
      .from(eventDelivery)
      .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
      .where(
        and(
          isNull(eventDelivery.deliveredAt),
          isNull(eventDelivery.deadLetteredAt),
          lte(eventDelivery.dueAt, this.clock.now()),
          heardDeliveries(hearings),
        ),
      )
      .orderBy(asc(eventDelivery.dueAt), asc(eventOutbox.recordedAt))
      .limit(1)
      .for('update', { of: eventDelivery, skipLocked: true });

    return row ?? null;
  }

  private async handled<T>(
    due: Due,
    then: (raised: readonly DomainEvent[]) => Promise<T>,
  ): Promise<T> {
    const subscriber = this.subscribers.named(due.subscriber);

    if (!subscriber) {
      throw new Error(`No subscriber is called ${due.subscriber} here`);
    }

    return this.telemetry.inSpan(
      due.subscriber,
      {
        eventId: due.eventId,
        eventKind: due.kind,
        subscriber: due.subscriber,
        ...idsOf(due.payload),
        causedByTraceId: traceIdOfTraceparent(due.traceparent),
      },
      () =>
        this.causes.runWith(due.cause, async () => {
          const raised = await subscriber.handle(
            this.outbox.decode(due.payload),
            { id: due.eventId, recordedAt: due.recordedAt },
          );

          return then(raised);
        }),
      due.traceparent,
    );
  }

  private async failed(
    due: Due,
    error: unknown,
    lease: Date | null = null,
  ): Promise<'retried' | 'dead_lettered' | 'lost'> {
    const attempts = due.attempts + 1;
    const now = this.clock.now();
    const next = this.retryOf(due).nextAttemptAt(attempts, now);

    const written = await this.context.db
      .update(eventDelivery)
      .set({
        attempts,
        lastError: because(error).slice(0, 2000),
        dueAt: next ?? now,
        deadLetteredAt: next ? null : now,
      })
      .where(this.open(due, lease))
      .returning({ eventId: eventDelivery.eventId });

    if (written.length === 0) {
      return 'lost';
    }

    return next ? 'retried' : 'dead_lettered';
  }

  // A subscriber that sets no retry gets the default.
  private retryOf(due: Due): Retry {
    return this.subscribers.retryOf(due.subscriber) ?? DEFAULT_RETRY;
  }

  private reported(due: Due, error: unknown): void {
    const attempts = due.attempts + 1;

    const deadLettering = this.retryOf(due).exhaustedAfter(attempts);

    this.logger.error(
      {
        err: error,
        eventId: due.eventId,
        eventKind: due.kind,
        subscriber: due.subscriber,
        attempts,
        ...idsOf(due.payload),
      },
      deadLettering
        ? 'Dead-lettering a domain event delivery'
        : 'Delivering a domain event',
    );

    if (deadLettering) {
      this.reports.report(error, {
        source: due.subscriber,
        ...idsOf(due.payload),
      });
    }
  }

  private counted(
    due: Due,
    outcome: 'delivered' | 'retried' | 'dead_lettered',
  ): void {
    this.telemetry.count(DELIVERIES_METRIC, {
      'spotlight.subscriber': due.subscriber,
      'spotlight.delivery.outcome': outcome,
    });
  }

  private open(due: Due, lease: Date | null) {
    return and(
      this.at(due),
      isNull(eventDelivery.deliveredAt),
      eq(eventDelivery.attempts, due.attempts),
      lease ? eq(eventDelivery.dueAt, lease) : undefined,
    );
  }

  private at(due: Due) {
    return and(
      eq(eventDelivery.eventId, due.eventId),
      eq(eventDelivery.subscriber, due.subscriber),
    );
  }
}
