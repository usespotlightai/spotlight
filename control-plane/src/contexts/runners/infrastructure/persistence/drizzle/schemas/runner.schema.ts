import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const runner = pgTable(
  'runner',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    harnesses: jsonb('harnesses').$type<string[]>().notNull().default([]),
    advertisedModels: jsonb('advertised_models')
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    revokedAt: timestamp('revoked_at'),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('runner_token_hash_idx').on(table.tokenHash),
    index('runner_workspace_idx').on(table.workspaceId),
  ],
);
