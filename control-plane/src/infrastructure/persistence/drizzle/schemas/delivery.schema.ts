import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const DELIVERY_STATES = ['pending', 'done', 'failed'] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];

/**
 * What a host has told us, kept as it arrived. Taken in at the door and
 * worked afterwards, so a host is answered before anything is looked up on
 * its word, and a delivery that fails to be worked is a row to look at rather
 * than a delivery nobody kept.
 */
export const inboundDelivery = pgTable(
  'inbound_delivery',
  {
    source: text('source').notNull(),
    /** As the source named it. Unique within that source and no further. */
    id: text('id').notNull(),
    headers: jsonb('headers').notNull(),
    body: jsonb('body').notNull(),
    state: text('state').$type<DeliveryState>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    /** Why the last attempt failed, for whoever comes to look. */
    failed: text('failed'),
    receivedAt: timestamp('received_at').defaultNow().notNull(),
    handledAt: timestamp('handled_at'),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.id] }),
    index('inbound_delivery_state_idx').on(table.state, table.receivedAt),
  ],
);
