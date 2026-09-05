import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@domain/value-objects/task-note.vo';
import type { SpokenBy } from '@domain/value-objects/voice.vo';

import { station } from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { runner } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface SaidRow {
  readonly body: string;
  readonly path: string | null;
  readonly from: number | null;
  readonly to: number | null;
  readonly remark: string | null;
}

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
    // The team member who owns the work. Set null when they leave, the same
    // way the task outlives whoever raised it.
    assigneeId: text('assignee_id').references(() => user.id, {
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
    repository: text('repository'),
    pullRequest: text('pull_request'),
    finishedAt: timestamp('finished_at'),
    // A write says which version it answers, so two answers to one reading
    // cannot both land.
    version: integer('version').notNull().default(0),
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
    voice: text('voice').$type<SpokenBy>().notNull().default('station'),
    // Set null on deletion rather than cascading: what was said stays, only
    // who said it is lost.
    authorId: text('author_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    // The run that wrote it, whose journal is what it came from.
    runId: text('run_id'),
    // An 'asked' opens a conversation a person owns; a 'passed' closes it.
    kind: text('kind').$type<TaskNoteKind>().notNull(),
    // What it shows, which is not what it did. Almost everything is words.
    form: text('form').$type<TaskNoteForm>().notNull().default('words'),
    // What the world said, kept whole: the host's name for it, and where.
    said: jsonb('said').$type<SaidRow>(),
    answeredAt: timestamp('answered_at'),
    readAt: timestamp('read_at'),
    // When it reached the agent working the task.
    deliveredAt: timestamp('delivered_at'),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.position] }),
    index('task_note_task_idx').on(table.taskId, table.position),
  ],
);

/**
 * Every handle the world outside knows a task by. Keyed by the handle rather
 * than by the task, because that is the direction a delivery asks in: it
 * carries a pull request address or an issue key and nothing else.
 */
export const taskMark = pgTable(
  'task_mark',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    /** The kind of handle, as in git.pull-request. */
    kind: text('kind').notNull(),
    value: text('value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.value] }),
    index('task_mark_task_idx').on(table.taskId),
  ],
);
