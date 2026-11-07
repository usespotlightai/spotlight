import { Inject, Injectable } from '@nestjs/common';
import { CauseCarrier } from '@platform/events/cause-carrier';
import { idsOf } from '@platform/events/event-ids';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventSubscribers } from '@platform/events/event-subscribers';
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
import { and, asc, count, eq, isNull, lte } from 'drizzle-orm';

export const MAX_ATTEMPTS = 8;

export const LEASE_MS = 5 * 60 * 1000;

export const LEASE_RENEWAL_MS = 60 * 1000;

export const LONGEST_LEASE_MS = 30 * 60 * 1000;

const DELIVERIES_METRIC = 'spotlight.outbox.deliveries';

const backoffMs = (attempts: number): number =>
  Math.min(2 ** attempts * 1000, 60 * 60 * 1000);

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

  async processDue(limit = 100): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.deliverOne())) {
      worked += 1;
    }

    return worked;
  }

  async drain(timeoutMs = 10_000): Promise<void> {
    const until = Date.now() + timeoutMs;

    for (;;) {
      await this.processDue();

      if ((await this.stillDue()) === 0 || Date.now() > until) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  private async stillDue(): Promise<number> {
    const [row] = await this.context.db
      .select({ due: count() })
      .from(eventDelivery)
      .where(
        and(
          isNull(eventDelivery.deliveredAt),
          isNull(eventDelivery.deadLetteredAt),
          lte(eventDelivery.dueAt, this.clock.now()),
        ),
      );

    return row?.due ?? 0;
  }

  private async deliverOne(): Promise<boolean> {
    const claim = await this.claimNext();

    if (claim.kind === 'leased') {
      await this.deliverLeased(claim.due, claim.lease);
    }

    return claim.kind !== 'none';
  }

  private async claimNext(): Promise<Claim> {
    const claimed: { due: Due | null; failure: { error: unknown } | null } = {
      due: null,
      failure: null,
    };

    try {
      const outcome = await this.context.inTransaction(async () => {
        const due = await this.nextDue();
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
    let outcome: Outcome | 'unsettled';

    try {
      outcome = await this.handled(due, async (raised) => {
        const current = await this.released(held);

        return this.context
          .inTransaction(() => this.settled(due, current, raised))
          .catch((error: unknown) => {
            this.unsettled(due, error);

            return 'unsettled' as const;
          });
      });
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

    if (outcome === 'unsettled') {
      return;
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
      this.logger.warn(
        {
          err: error,
          eventId: due.eventId,
          subscriber: due.subscriber,
          ...idsOf(due.payload),
        },
        'Renewing the lease of a domain event delivery',
      );
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

  private unsettled(due: Due, error: unknown): void {
    this.logger.error(
      {
        err: error,
        eventId: due.eventId,
        eventKind: due.kind,
        subscriber: due.subscriber,
        ...idsOf(due.payload),
      },
      'Recording a handled domain event delivery; it is retried once its lease ends',
    );
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

  private async nextDue(): Promise<Due | null> {
    const [row] = await this.context.db
      .select({
        eventId: eventDelivery.eventId,
        subscriber: eventDelivery.subscriber,
        attempts: eventDelivery.attempts,
        kind: eventOutbox.kind,
        payload: eventOutbox.payload,
        cause: eventOutbox.cause,
        traceparent: eventOutbox.traceparent,
      })
      .from(eventDelivery)
      .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
      .where(
        and(
          isNull(eventDelivery.deliveredAt),
          isNull(eventDelivery.deadLetteredAt),
          lte(eventDelivery.dueAt, this.clock.now()),
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
      throw new Error(`No subscriber is called ${due.subscriber} any more`);
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
    const deadLettering = attempts >= MAX_ATTEMPTS;

    const written = await this.context.db
      .update(eventDelivery)
      .set({
        attempts,
        lastError: because(error).slice(0, 2000),
        dueAt: new Date(now.getTime() + backoffMs(attempts)),
        deadLetteredAt: deadLettering ? now : null,
      })
      .where(this.open(due, lease))
      .returning({ eventId: eventDelivery.eventId });

    if (written.length === 0) {
      return 'lost';
    }

    return deadLettering ? 'dead_lettered' : 'retried';
  }

  private reported(due: Due, error: unknown): void {
    const attempts = due.attempts + 1;
    const deadLettering = attempts >= MAX_ATTEMPTS;

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
