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
    const claimed: { due: Due | null } = { due: null };

    try {
      const delivered = await this.context.inTransaction(async () => {
        const due = await this.nextDue();
        claimed.due = due;

        if (!due) {
          return false;
        }

        await this.handle(due);
        await this.context.db
          .update(eventDelivery)
          .set({ deliveredAt: this.clock.now(), attempts: due.attempts + 1 })
          .where(this.at(due));

        return true;
      });

      if (delivered && claimed.due) {
        this.counted(claimed.due, 'delivered');
      }

      return delivered;
    } catch (error) {
      if (!claimed.due) {
        throw error;
      }

      await this.failed(claimed.due, error);
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

  private async failed(due: Due, error: unknown): Promise<void> {
    const attempts = due.attempts + 1;
    const now = this.clock.now();
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

    this.counted(due, deadLettering ? 'dead_lettered' : 'retried');

    if (deadLettering) {
      this.reports.report(error, {
        source: due.subscriber,
        ...idsOf(due.payload),
      });
    }

    await this.context.inTransaction(() =>
      this.context.db
        .update(eventDelivery)
        .set({
          attempts,
          lastError: because(error).slice(0, 2000),
          dueAt: new Date(now.getTime() + backoffMs(attempts)),
          deadLetteredAt: deadLettering ? now : null,
        })
        .where(this.at(due))
        .then(() => undefined),
    );
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
