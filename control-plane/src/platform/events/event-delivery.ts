import { Inject, Injectable } from '@nestjs/common';
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
  CAUSATION,
  type CausationPort,
} from '@shared-kernel/application/ports/causation.port';
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
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { and, asc, count, eq, isNull, lte } from 'drizzle-orm';

export const MAX_ATTEMPTS = 8;

const DELIVERIES_METRIC = 'spotlight.outbox.deliveries';

const backoffMs = (attempts: number): number =>
  Math.min(2 ** attempts * 1000, 60 * 60 * 1000);

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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
    @Inject(CAUSATION) private readonly causation: CausationPort,
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

        try {
          await this.context.inSavepoint(() => this.handle(due));
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

      if (outcome && outcome !== 'lost' && claimed.due) {
        this.counted(claimed.due, outcome);
      }

      return outcome !== null;
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
        this.logger.warn(
          {
            err: failure,
            eventId: due.eventId,
            subscriber: due.subscriber,
            ...idsOf(due.payload),
          },
          'Another instance settled this domain event delivery first',
        );
        return true;
      }

      this.reported(due, failure);
      this.counted(due, outcome);
      return true;
    }
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

  private async handle(due: Due): Promise<void> {
    const subscriber = this.subscribers.named(due.subscriber);

    if (!subscriber) {
      throw new Error(`No subscriber is called ${due.subscriber} any more`);
    }

    await this.telemetry.inSpan(
      due.subscriber,
      {
        eventId: due.eventId,
        eventKind: due.kind,
        subscriber: due.subscriber,
        ...idsOf(due.payload),
        causedByTraceId: traceIdOfTraceparent(due.traceparent),
      },
      () =>
        this.causation.runWith(CausalChain.read(due.cause), async () => {
          const raised = await subscriber.handle(
            this.outbox.decode(due.payload),
          );

          await this.outbox.record(raised);
        }),
      due.traceparent,
    );
  }

  private async failed(
    due: Due,
    error: unknown,
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
      .where(
        and(
          this.at(due),
          isNull(eventDelivery.deliveredAt),
          eq(eventDelivery.attempts, due.attempts),
        ),
      )
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

  private at(due: Due) {
    return and(
      eq(eventDelivery.eventId, due.eventId),
      eq(eventDelivery.subscriber, due.subscriber),
    );
  }
}
