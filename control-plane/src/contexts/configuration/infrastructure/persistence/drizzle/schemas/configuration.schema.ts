import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const integrationLink = pgTable(
  'integration_link',
  {
    teamId: text('team_id').notNull(),
    source: text('source').notNull(),
    handle: text('handle'),
    linkedAt: timestamp('linked_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);
