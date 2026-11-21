import type { Hearing } from '@platform/events/event-subscribers';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { INTEGRATION_EVENT_KIND } from '@shared-kernel/application/integration-events/integration-event';
import { and, eq, inArray, like, or, type SQL, sql } from 'drizzle-orm';

// The deliveries whose subscriber hears the kind of their event, in SQL: the same rule as EventSubscribers.hears, from the same hearings. A query that uses it joins event_outbox. A prefix is a context prefix, so it holds no LIKE wildcard.
export const heardDeliveries = (hearings: readonly Hearing[]): SQL => {
  const each = hearings.flatMap((hearing) => {
    const named =
      hearing.kinds.length > 0
        ? inArray(eventOutbox.kind, [...hearing.kinds])
        : undefined;
    const prefixed =
      hearing.prefixes.length > 0
        ? and(
            sql`${eventOutbox.kind} ~ ${INTEGRATION_EVENT_KIND.source}`,
            or(
              ...hearing.prefixes.map((prefix) =>
                like(eventOutbox.kind, `${prefix}%`),
              ),
            ),
          )
        : undefined;
    const kinds = or(named, prefixed);

    return kinds
      ? [and(eq(eventDelivery.subscriber, hearing.name), kinds)]
      : [];
  });

  return or(...each) ?? sql`false`;
};
