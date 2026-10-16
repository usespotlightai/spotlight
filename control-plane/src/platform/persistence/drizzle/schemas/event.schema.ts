import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const eventOutbox = pgTable('event_outbox', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  cause: jsonb('cause'),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

export const eventDelivery = pgTable(
  'event_delivery',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => eventOutbox.id, { onDelete: 'cascade' }),
    subscriber: text('subscriber').notNull(),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamp('due_at').defaultNow().notNull(),
    deliveredAt: timestamp('delivered_at'),
    failedAt: timestamp('failed_at'),
    lastError: text('last_error'),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.subscriber] }),
    index('event_delivery_due_idx').on(table.dueAt),
    index('event_delivery_owed_idx')
      .on(table.subscriber)
      .where(sql`${table.deliveredAt} is null`),
  ],
);
