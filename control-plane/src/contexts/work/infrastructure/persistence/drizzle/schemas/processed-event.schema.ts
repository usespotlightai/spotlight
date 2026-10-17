import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const processedEvent = pgTable(
  'processed_event',
  {
    workspaceId: text('workspace_id').notNull(),
    key: text('key').notNull(),
    processedAt: timestamp('processed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.key] }),
    index('processed_event_processed_at_idx').on(table.processedAt),
  ],
);
