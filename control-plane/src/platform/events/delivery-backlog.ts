import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

export interface PendingDeliveries {
  readonly pending: number;
  readonly deadLettered: number;
}

@Injectable()
export class DeliveryBacklog {
  constructor(private readonly context: DrizzleContext) {}

  async pendingDeliveriesFor(
    subscriber: string,
    matching: Readonly<Record<string, string>>,
  ): Promise<PendingDeliveries> {
    const undelivered = await this.context.db
      .select({ deadLetteredAt: eventDelivery.deadLetteredAt })
      .from(eventDelivery)
      .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
      .where(
        and(
          eq(eventDelivery.subscriber, subscriber),
          isNull(eventDelivery.deliveredAt),
          ...Object.entries(matching).map(
            ([field, value]) =>
              sql`coalesce(${eventOutbox.payload}->${field}->>'value', ${eventOutbox.payload}->>${field}) = ${value}`,
          ),
        ),
      );

    return {
      pending: undelivered.length,
      deadLettered: undelivered.filter((each) => each.deadLetteredAt !== null)
        .length,
    };
  }
}
