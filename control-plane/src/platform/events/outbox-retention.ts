import { Inject, Injectable } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
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
} from 'drizzle-orm';

export const OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60_000;
const OUTBOX_RETENTION_BATCH = 1_000;
const OUTBOX_RETENTION_BATCHES = 50;

// An event stays while a delivery of it waits, or while a subscriber keeps a dead letter of it that it still hears: it is registered, and it hears the kind. The other dead letters go with their event, such as those of the event webhook once SPOTLIGHT_EVENT_WEBHOOK_URL is unset, or of a kind that SPOTLIGHT_EVENT_WEBHOOK_KINDS no longer names.
@Injectable()
export class OutboxRetention {
  // The last event that a sweep of dead letters looked at, so that the next sweep goes on after it.
  #after: string | null = null;

  constructor(
    private readonly context: DrizzleContext,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly subscribers: EventSubscribers,
  ) {}

  async sweep(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - OUTBOX_RETENTION_MS);
    let deleted = 0;

    for (let batch = 0; batch < OUTBOX_RETENTION_BATCHES; batch += 1) {
      const removed = await this.deleteDelivered(before);
      deleted += removed;

      if (removed < OUTBOX_RETENTION_BATCH) {
        break;
      }
    }

    for (let batch = 0; batch < OUTBOX_RETENTION_BATCHES; batch += 1) {
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
      .limit(OUTBOX_RETENTION_BATCH);

    const removed = await db
      .delete(eventOutbox)
      .where(inArray(eventOutbox.id, settled))
      .returning({ id: eventOutbox.id });

    return removed.length;
  }

  // The events whose open deliveries are all dead letters that no subscriber still hears.
  private async deleteUnheard(
    before: Date,
  ): Promise<{ readonly removed: number; readonly more: boolean }> {
    const db = this.context.db;
    const dead = await db
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
      .having(sql`bool_and(${eventDelivery.deadLetteredAt} is not null)`)
      .orderBy(asc(eventOutbox.id))
      .limit(OUTBOX_RETENTION_BATCH);
    const unheard = dead
      .filter(
        (event) =>
          !event.subscribers.some((each) =>
            this.subscribers.hears(each, event.kind),
          ),
      )
      .map((event) => event.id);
    const more = dead.length === OUTBOX_RETENTION_BATCH;

    this.#after = more ? (dead[dead.length - 1]?.id ?? null) : null;

    if (unheard.length === 0) {
      return { removed: 0, more };
    }

    const removed = await db
      .delete(eventOutbox)
      .where(inArray(eventOutbox.id, unheard))
      .returning({ id: eventOutbox.id });

    return { removed: removed.length, more };
  }
}
