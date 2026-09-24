import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const workspacePlan = pgTable('workspace_plan', {
  workspaceId: text('workspace_id').primaryKey(),
  plan: text('plan').notNull(),
  lapsesAt: timestamp('lapses_at'),
  version: integer('version').notNull().default(0),
});

export const catalogCall = pgTable(
  'catalog_call',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    runId: text('run_id').notNull(),
    item: text('item').notNull(),
    calledAt: timestamp('called_at').notNull(),
    ms: integer('ms').notNull(),
    succeeded: boolean('succeeded').notNull(),
    billable: boolean('billable').notNull(),
  },
  (table) => [
    index('catalog_call_workspace_called_idx').on(
      table.workspaceId,
      table.calledAt,
    ),
  ],
);
