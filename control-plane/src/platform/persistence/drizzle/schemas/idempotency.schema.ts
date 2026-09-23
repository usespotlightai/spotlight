import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const idempotentCreate = pgTable(
  'idempotent_create',
  {
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    createdId: text('created_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
);
