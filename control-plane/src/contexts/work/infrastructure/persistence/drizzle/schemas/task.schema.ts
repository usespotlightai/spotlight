import type {
  JsonObject,
  JsonValue,
} from '@shared-kernel/domain/services/json-value';
import type {
  TaskNoteForm,
  TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import type { ApprovalStatus } from '@work/domain/value-objects/approval.vo';
import type { AuthorKind } from '@work/domain/value-objects/voice.vo';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface AnchorRow {
  readonly body: string;
  readonly path: string | null;
  readonly from: number | null;
  readonly to: number | null;
  readonly reviewComment: string | null;
}

export type ApprovalSubjectRow =
  | {
      readonly kind: 'tool-call';
      readonly tool: string;
      readonly inputs: Readonly<Record<string, JsonValue>>;
      readonly shapes: Readonly<Record<string, JsonObject>>;
    }
  | {
      readonly kind: 'harness-permission';
      readonly harness: string;
      readonly asks: string;
      readonly title: string;
      readonly input: string;
      readonly called: {
        readonly server: string | null;
        readonly tool: string;
      } | null;
    };

export interface ApprovalRow {
  readonly subject: ApprovalSubjectRow;
  readonly stationId: string;
  readonly because: string;
  readonly status: ApprovalStatus;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly reason: string | null;
  readonly spent: boolean;
  readonly edited?: Readonly<Record<string, JsonValue>> | null;
  readonly intent?: string | null;
  readonly askedOf?: string | null;
}

export type DeferredMoveRow =
  | { readonly kind: 'moves'; readonly to: string }
  | { readonly kind: 'cleared' };

export interface ConnectionAskRow {
  readonly teamId: string;
  readonly source: string;
  readonly integration: string;
  readonly personId: string;
  readonly met: boolean;
}

export interface FailureRow {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
}

export const task = pgTable(
  'task',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    stationId: text('station_id')
      .notNull()
      .references(() => station.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description'),
    rank: text('rank').notNull().default('i'),
    raisedAtStationId: text('raised_at_station_id').references(
      () => station.id,
      { onDelete: 'set null' },
    ),
    raisedById: text('raised_by_id'),
    openedFrom: text('opened_from').notNull(),
    assigneeId: text('assignee_id'),
    currentRunId: text('current_run_id'),
    sessionId: text('session_id'),
    runnerId: text('runner_id'),
    pullRequest: text('pull_request'),
    reviewing: boolean('reviewing').notNull().default(false),
    reviewFromOutside: boolean('review_from_outside').notNull().default(false),
    finishedAt: timestamp('finished_at'),
    revision: integer('revision').notNull().default(0),
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
    voice: text('voice').$type<AuthorKind>().notNull().default('station'),
    authorId: text('author_id'),
    runId: text('run_id'),
    kind: text('kind').$type<TaskNoteKind>().notNull(),
    form: text('form').$type<TaskNoteForm>().notNull().default('words'),
    anchor: jsonb('anchor').$type<AnchorRow>(),
    approval: jsonb('approval').$type<ApprovalRow>(),
    failure: jsonb('failure').$type<FailureRow>(),
    deferredMove: jsonb('deferred_move').$type<DeferredMoveRow>(),
    connectionAsk: jsonb('connection_ask').$type<ConnectionAskRow>(),
    answeredAt: timestamp('answered_at'),
    readAt: timestamp('read_at'),
    acknowledgedAt: timestamp('acknowledged_at'),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.position] }),
    index('task_note_task_idx').on(table.taskId, table.position),
    index('task_note_connection_ask_idx')
      .on(
        sql`(${table.connectionAsk}->>'personId')`,
        sql`(${table.connectionAsk}->>'source')`,
      )
      .where(
        sql`${table.connectionAsk} is not null and (${table.connectionAsk}->>'met')::boolean = false`,
      ),
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
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.kind, table.value] }),
    index('task_mark_task_idx').on(table.taskId),
  ],
);
