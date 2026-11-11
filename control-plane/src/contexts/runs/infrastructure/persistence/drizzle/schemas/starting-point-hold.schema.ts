import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const startingPointHold = pgTable(
  'starting_point_hold',
  {
    holder: text('holder').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    unique('starting_point_hold_workspace_id_holder_key').on(
      table.workspaceId,
      table.holder,
    ),
  ],
);

export const startingPointHoldRun = pgTable(
  'starting_point_hold_run',
  {
    holder: text('holder').notNull(),
    workspaceId: text('workspace_id').notNull(),
    runId: text('run_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.holder, table.runId] }),
    foreignKey({
      name: 'starting_point_hold_run_hold_fk',
      columns: [table.workspaceId, table.holder],
      foreignColumns: [startingPointHold.workspaceId, startingPointHold.holder],
    }).onDelete('cascade'),
    index('starting_point_hold_run_run_idx').on(table.workspaceId, table.runId),
  ],
);
