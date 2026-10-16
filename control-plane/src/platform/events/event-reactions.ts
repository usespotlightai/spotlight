import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

export interface OwedReactions {
  readonly owed: number;
  readonly givenUp: number;
}

@Injectable()
export class EventReactions {
  constructor(private readonly context: DrizzleContext) {}

  async owedBy(
    subscriber: string,
    matching: Readonly<Record<string, string>>,
  ): Promise<OwedReactions> {
    const owed = await this.context.db
      .select({ failedAt: eventDelivery.failedAt })
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
      owed: owed.length,
      givenUp: owed.filter((each) => each.failedAt !== null).length,
    };
  }
}
