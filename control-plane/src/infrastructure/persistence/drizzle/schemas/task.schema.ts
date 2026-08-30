import { station } from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { runner } from '@infrastructure/persistence/drizzle/schemas/run.schema';
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
    // Where the task was raised. It keeps this as it moves down the line, so
    // what was asked for still says where it was asked.
    raisedAtStationId: text('raised_at_station_id').references(
      () => station.id,
      { onDelete: 'set null' },
    ),
    // Set null rather than cascading: the task outlives the person leaving.
    raisedById: text('raised_by_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    currentRunId: text('current_run_id'),
    // What the harness called the conversation this task was last worked in.
    // Opaque here: it is handed back to a harness, never read.
    sessionId: text('session_id'),
    // The runner holding the directory that session lives in. Set null rather
    // than cascading: losing the runner loses the workspace, not the task.
    runnerId: text('runner_id').references(() => runner.id, {
      onDelete: 'set null',
    }),
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
    // Null is the station speaking. Set null on deletion rather than cascading:
    // what was said stays, only who said it is lost.
    authorId: text('author_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    // The run that wrote it, whose journal is what it came from.
    runId: text('run_id'),
    // What it did to the task. An 'asked' opens a stretch a person owns; a
    // 'passed' closes it. The inbox is made of those stretches.
    kind: text('kind').$type<'asked' | 'passed' | 'answered'>(),
    readAt: timestamp('read_at'),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.position] }),
    index('task_note_task_idx').on(table.taskId, table.position),
  ],
);
