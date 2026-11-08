import { timestamptz } from '@platform/persistence/drizzle/columns';
import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const pushSubscription = pgTable(
  'push_subscription',
  {
    endpoint: text('endpoint').primaryKey(),
    personId: text('person_id').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    renewedAt: timestamptz('renewed_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [index('push_subscription_person_idx').on(table.personId)],
);
