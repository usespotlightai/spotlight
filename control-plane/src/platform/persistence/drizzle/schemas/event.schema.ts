import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

export const eventOutbox = pgTable('event_outbox', {
  id: uuid('id').primaryKey(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  cause: jsonb('cause'),
  traceparent: text('traceparent'),
  recordedAt: timestamptz('recorded_at').defaultNow().notNull(),
});

export const eventDelivery = pgTable(
  'event_delivery',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => eventOutbox.id, { onDelete: 'cascade' }),
    subscriber: text('subscriber').notNull(),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamptz('due_at').defaultNow().notNull(),
    deliveredAt: timestamptz('delivered_at'),
    deadLetteredAt: timestamptz('dead_lettered_at'),
    lastError: text('last_error'),
  },
  (table) => [
    check('event_delivery_attempts_not_negative', sql`${table.attempts} >= 0`),
    primaryKey({ columns: [table.eventId, table.subscriber] }),
    index('event_delivery_due_idx').on(table.dueAt),
    index('event_delivery_pending_idx')
      .on(table.subscriber)
      .where(sql`${table.deliveredAt} is null`),
  ],
);
