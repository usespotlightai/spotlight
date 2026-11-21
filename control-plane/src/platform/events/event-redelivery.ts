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
import { and, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm';

// Dead letters stay in event_delivery, and the outbox keeps their events, until they are delivered.
@Injectable()
export class EventRedelivery {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  // Queues the dead letters of one subscriber again, for the events recorded at or after the time. Each gets all its attempts again. Returns how many it queued.
  async redeliver(subscriber: string, since: Date): Promise<number> {
    const db = this.context.db;
    const queued = await db
      .update(eventDelivery)
      .set({ attempts: 0, deadLetteredAt: null, dueAt: this.clock.now() })
      .where(
        and(
          eq(eventDelivery.subscriber, subscriber),
          isNull(eventDelivery.deliveredAt),
          isNotNull(eventDelivery.deadLetteredAt),
          inArray(
            eventDelivery.eventId,
            db
              .select({ id: eventOutbox.id })
              .from(eventOutbox)
              .where(gte(eventOutbox.recordedAt, since)),
          ),
        ),
      )
      .returning({ eventId: eventDelivery.eventId });

    return queued.length;
  }
}
