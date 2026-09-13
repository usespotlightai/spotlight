import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@domain/value-objects/task-note.vo';
import type { SpokenBy } from '@domain/value-objects/voice.vo';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { station } from '@infrastructure/persistence/drizzle/schemas/line.schema';
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
    raisedAtStationId: text('raised_at_station_id').references(
      () => station.id,
      { onDelete: 'set null' },
    ),
    raisedById: text('raised_by_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    assigneeId: text('assignee_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    currentRunId: text('current_run_id'),
    sessionId: text('session_id'),
    runnerId: text('runner_id').references(() => runner.id, {
      onDelete: 'set null',
    }),
    pullRequest: text('pull_request'),
    finishedAt: timestamp('finished_at'),
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
    authorId: text('author_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    runId: text('run_id'),
    kind: text('kind').$type<TaskNoteKind>().notNull(),
    form: text('form').$type<TaskNoteForm>().notNull().default('words'),
    said: jsonb('said').$type<SaidRow>(),
    answeredAt: timestamp('answered_at'),
    readAt: timestamp('read_at'),
    deliveredAt: timestamp('delivered_at'),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.position] }),
    index('task_note_task_idx').on(table.taskId, table.position),
  ],
);

export const taskAttachment = pgTable(
  'task_attachment',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    notePosition: integer('note_position'),
    place: integer('place').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('task_attachment_task_idx').on(table.taskId, table.notePosition),
  ],
);

export const taskMark = pgTable(
  'task_mark',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.value] }),
    index('task_mark_task_idx').on(table.taskId),
  ],
);
