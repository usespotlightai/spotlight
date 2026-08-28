import { station } from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const task = pgTable(
  'task',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    stationId: text('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    rank: text('rank').notNull().default('i'),
    currentRunId: text('current_run_id'),
    awaitingReview: boolean('awaiting_review').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('task_station_idx').on(table.stationId, table.rank),
    index('task_workspace_idx').on(table.workspaceId),
  ],
);

export const taskNote = pgTable(
  'task_note',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    station: text('station').notNull(),
    body: text('body').notNull(),
    at: timestamp('at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.position] }),
    index('task_note_task_idx').on(table.taskId, table.position),
  ],
);
