import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const heardHappening = pgTable(
  'heard_happening',
  {
    workspaceId: text('workspace_id').notNull(),
    key: text('key').notNull(),
    heardAt: timestamp('heard_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.key] }),
    index('heard_happening_heard_at_idx').on(table.heardAt),
  ],
);
