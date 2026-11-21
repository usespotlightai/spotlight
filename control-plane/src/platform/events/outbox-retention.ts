import {
  lockDeliveries,
  untouchedSince,
} from '@platform/events/event-delivery';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  notExists,
  sql,
  not,
} from 'drizzle-orm';

export const OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60_000;

// A sweep deletes at most batches times batch events in each of its two passes.
export interface OutboxRetentionLimits {
  readonly batch: number;
  readonly batches: number;
}

const OUTBOX_RETENTION_LIMITS: OutboxRetentionLimits = {
  batch: 1_000,
  batches: 50,
};

// An event stays while a subscriber of this instance hears one of its open deliveries: it is registered, and it hears the kind. An event older than the retention age whose open deliveries nobody here hears goes, with its dead letters and its deliveries that waited untouched since then, such as those of the event webhook once SPOTLIGHT_EVENT_WEBHOOK_URL is unset, of a kind that SPOTLIGHT_EVENT_WEBHOOK_KINDS no longer names, or of a subscriber that is gone.
export class OutboxRetention {
  // The last event that a sweep of dead letters looked at, so that the next sweep goes on after it.
  #after: string | null = null;

  constructor(
    private readonly context: DrizzleContext,
    private readonly clock: ClockPort,
    private readonly subscribers: EventSubscribers,
    private readonly limits: OutboxRetentionLimits = OUTBOX_RETENTION_LIMITS,
  ) {}

  async sweep(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - OUTBOX_RETENTION_MS);
    let deleted = 0;

    for (let batch = 0; batch < this.limits.batches; batch += 1) {
      const removed = await this.deleteDelivered(before);
      deleted += removed;

      if (removed < this.limits.batch) {
        break;
      }
    }

    for (let batch = 0; batch < this.limits.batches; batch += 1) {
      const { removed, more } = await this.deleteUnheard(before);
      deleted += removed;

      if (!more) {
        break;
      }
    }

    return deleted;
  }

  // The events with every delivery delivered.
  private async deleteDelivered(before: Date): Promise<number> {
    const db = this.context.db;
    const settled = db
      .select({ id: eventOutbox.id })
      .from(eventOutbox)
      .where(
        and(
          lt(eventOutbox.recordedAt, before),
          notExists(
            db
              .select({ one: sql`1` })
              .from(eventDelivery)
              .where(
                and(
                  eq(eventDelivery.eventId, eventOutbox.id),
                  isNull(eventDelivery.deliveredAt),
                ),
              ),
          ),
        ),
      )
      .limit(this.limits.batch);

    const removed = await db
      .delete(eventOutbox)
      .where(inArray(eventOutbox.id, settled))
      .returning({ id: eventOutbox.id });

    return removed.length;
  }

  // The events whose open deliveries no subscriber of this instance hears, where each open delivery is untouched since before the retention age: no attempt, dead letter, lease or redelivery since then. A dead letter's due time is when it became one.
  private async deleteUnheard(
    before: Date,
  ): Promise<{ readonly removed: number; readonly more: boolean }> {
    const abandoned = await this.context.db
      .select({
        id: eventOutbox.id,
        kind: eventOutbox.kind,
        subscribers: sql<string[]>`array_agg(${eventDelivery.subscriber})`,
      })
      .from(eventOutbox)
      .innerJoin(
        eventDelivery,
        and(
          eq(eventDelivery.eventId, eventOutbox.id),
          isNull(eventDelivery.deliveredAt),
        ),
      )
      .where(
        and(
          lt(eventOutbox.recordedAt, before),
          this.#after ? gt(eventOutbox.id, this.#after) : undefined,
        ),
      )
      .groupBy(eventOutbox.id)
      .having(sql`bool_and(${untouchedSince(before)})`)
      .orderBy(asc(eventOutbox.id))
      .limit(this.limits.batch);
    const unheard = abandoned
      .filter(
        (event) =>
          !event.subscribers.some((each) =>
            this.subscribers.hears(each, event.kind),
          ),
      )
      .map((event) => event.id);
    const more = abandoned.length === this.limits.batch;

    this.#after = more ? (abandoned[abandoned.length - 1]?.id ?? null) : null;

    if (unheard.length === 0) {
      return { removed: 0, more };
    }

    const removed = await this.context.inTransaction(async () => {
      const db = this.context.db;

      // Waits for an instance that queues one of these dead letters again right now. The delete then reads a fresh snapshot.
      await lockDeliveries(db, inArray(eventDelivery.eventId, unheard));

      // An event with a delivery touched since the retention age, as one queued again or claimed by another instance, stays.
      return db
        .delete(eventOutbox)
        .where(
          and(
            inArray(eventOutbox.id, unheard),
            lt(eventOutbox.recordedAt, before),
            notExists(
              db
                .select({ one: sql`1` })
                .from(eventDelivery)
                .where(
                  and(
                    eq(eventDelivery.eventId, eventOutbox.id),
                    isNull(eventDelivery.deliveredAt),
                    not(untouchedSince(before)),
                  ),
                ),
            ),
          ),
        )
        .returning({ id: eventOutbox.id });
    });

    return { removed: removed.length, more };
  }
}
