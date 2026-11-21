import type { Hearing } from '@platform/events/event-subscribers';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { INTEGRATION_EVENT_KIND } from '@shared-kernel/application/integration-events/integration-event';
import { and, eq, like, or, type SQL, sql } from 'drizzle-orm';

// The deliveries whose subscriber hears the kind of their event, in SQL: the same rule as EventSubscribers.hears, from the same hearings. A query that uses it joins event_outbox. A prefix is a context prefix, so it holds no LIKE wildcard.
// Each pair of a subscriber and a kind that it names is at the same position in two array parameters. Thus the SQL has the same length for all numbers of subscribers, and Postgres can plan each claim quickly.
export const heardDeliveries = (hearings: readonly Hearing[]): SQL => {
  const subscribers = hearings.flatMap((hearing) =>
    hearing.kinds.map(() => hearing.name),
  );
  const kinds = hearings.flatMap((hearing) => hearing.kinds);
  const named =
    kinds.length > 0
      ? sql`(${eventDelivery.subscriber}, ${eventOutbox.kind}) in (select * from unnest(${sql.param(subscribers)}::text[], ${sql.param(kinds)}::text[]))`
      : undefined;
  const prefixed = hearings.flatMap((hearing) =>
    hearing.prefixes.length > 0
      ? [
          and(
            eq(eventDelivery.subscriber, hearing.name),
            sql`${eventOutbox.kind} ~ ${INTEGRATION_EVENT_KIND.source}`,
            or(
              ...hearing.prefixes.map((prefix) =>
                like(eventOutbox.kind, `${prefix}%`),
              ),
            ),
          ),
        ]
      : [],
  );

  return or(named, ...prefixed) ?? sql`false`;
};
