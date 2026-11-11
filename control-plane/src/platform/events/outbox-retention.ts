import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { and, eq, inArray, isNull, lt, notExists, sql } from 'drizzle-orm';

export const OUTBOX_RETENTION_MS = 7 * 24 * 60 * 60_000;
const OUTBOX_RETENTION_BATCH = 1_000;
const OUTBOX_RETENTION_BATCHES = 50;

@Injectable()
export class OutboxRetention {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async sweep(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - OUTBOX_RETENTION_MS);
    let deleted = 0;

    for (let batch = 0; batch < OUTBOX_RETENTION_BATCHES; batch += 1) {
      const removed = await this.deletedBefore(before);
      deleted += removed;

      if (removed < OUTBOX_RETENTION_BATCH) {
        break;
      }
    }

    return deleted;
  }

  private async deletedBefore(before: Date): Promise<number> {
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
}
