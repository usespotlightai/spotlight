import { Inject, Injectable } from '@nestjs/common';
import { EventOutbox } from '@platform/events/event-outbox';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
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
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { and, asc, count, eq, isNull, lte } from 'drizzle-orm';

export const MAX_ATTEMPTS = 8;

const backoffMs = (attempts: number): number =>
  Math.min(2 ** attempts * 1000, 60 * 60 * 1000);

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fieldOf = (encoded: unknown, key: string): unknown =>
  typeof encoded === 'object' && encoded !== null
    ? (encoded as Record<string, unknown>)[key]
    : undefined;

const idOf = (payload: unknown, key: string): string | undefined => {
  const field = fieldOf(payload, key);
  const id = typeof field === 'string' ? field : fieldOf(field, 'value');

  return typeof id === 'string' ? id : undefined;
};

interface Due {
  readonly eventId: string;
  readonly subscriber: string;
  readonly attempts: number;
  readonly payload: unknown;
  readonly cause: unknown;
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
      return await this.context.inTransaction(async () => {
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
        payload: eventOutbox.payload,
        cause: eventOutbox.cause,
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

    await this.causation.within(CausalChain.read(due.cause), async () => {
      const raised = await subscriber.handle(this.outbox.decode(due.payload));

      await this.outbox.record(raised);
    });
  }

  private async failed(due: Due, error: unknown): Promise<void> {
    const attempts = due.attempts + 1;
    const now = this.clock.now();
    const deadLettering = attempts >= MAX_ATTEMPTS;

    this.logger.error(
      { err: error, subscriber: due.subscriber, attempts },
      deadLettering
        ? 'Dead-lettering a domain event delivery'
        : 'Delivering a domain event',
    );

    if (deadLettering) {
      this.reports.report(error, {
        source: due.subscriber,
        workspaceId: idOf(due.payload, 'workspaceId'),
        teamId: idOf(due.payload, 'teamId'),
        taskId: idOf(due.payload, 'taskId'),
        runId: idOf(due.payload, 'runId'),
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

  private at(due: Due) {
    return and(
      eq(eventDelivery.eventId, due.eventId),
      eq(eventDelivery.subscriber, due.subscriber),
    );
  }
}
