import { timestamptz } from '@platform/persistence/drizzle/columns';
import type {
  JsonObject,
  JsonValue,
} from '@shared-kernel/domain/services/json-value';
import {
  TASK_NOTE_FORMS,
  TASK_NOTE_KINDS,
} from '@work/domain/entities/task-note.entity';
import type { ApprovalStatus } from '@work/domain/value-objects/approval.vo';
import { VOICES } from '@work/domain/value-objects/voice.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { workStation } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
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

export interface DeferredMoveRow {
  readonly to: string;
}

export interface ConnectionAskRow {
  readonly teamId: string;
  readonly integration: string;
  readonly integrationName: string;
  readonly personId: string;
  readonly met: boolean;
}

export interface FailureRow {
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
}

export const taskNoteKind = pgEnum('task_note_kind', TASK_NOTE_KINDS);
export const taskNoteForm = pgEnum('task_note_form', TASK_NOTE_FORMS);
export const voice = pgEnum('voice', VOICES);

export const task = pgTable(
  'task',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    stationId: text('station_id').notNull(),
    title: text('title').notNull(),
    branch: text('branch').notNull(),
    description: text('description'),
    rank: text('rank').notNull().default('i'),
    originStationId: text('origin_station_id'),
    createdById: text('created_by_id'),
    openedFrom: text('opened_from').notNull(),
    proposedInChatId: text('proposed_in_chat_id'),
    proposedInPosition: integer('proposed_in_position'),
    assigneeId: text('assignee_id'),
    currentRunId: text('current_run_id'),
    sessionId: text('session_id'),
    runnerId: text('runner_id'),
    pullRequest: text('pull_request'),
    reviewing: boolean('reviewing').notNull().default(false),
    reviewFromOutside: boolean('review_from_outside').notNull().default(false),
    finishedAt: timestamptz('finished_at'),
    revision: integer('revision').notNull().default(0),
    isSetup: boolean('is_setup').notNull().default(false),
    setupOpen: boolean('setup_open').notNull().default(false),
    unreadAsk: boolean('unread_ask').notNull().default(false),
    draftGeneration: integer('draft_generation').notNull().default(0),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('task_workspace_id_id_key').on(table.workspaceId, table.id),
    foreignKey({
      name: 'task_station_fk',
      columns: [table.stationId],
      foreignColumns: [workStation.stationId],
    }).onDelete('restrict'),
    index('task_proposed_in_chat_idx').on(table.proposedInChatId),
    index('task_station_idx').on(table.stationId, table.rank),
    index('task_origin_station_idx').on(table.originStationId),
    index('task_workspace_idx').on(table.workspaceId),
    index('task_workspace_assignee_idx').on(
      table.workspaceId,
      table.assigneeId,
    ),
    uniqueIndex('task_workspace_branch_uidx').on(
      table.workspaceId,
      table.branch,
    ),
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
    stationId: text('station_id').notNull(),
    body: text('body').notNull(),
    at: timestamptz('at').notNull(),
    voice: voice('voice').notNull().default('station'),
    authorId: text('author_id'),
    coAuthorIds: text('co_author_ids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    runId: text('run_id').references(() => run.id),
    kind: taskNoteKind('kind').notNull(),
    closesConversation: boolean('closes_conversation').notNull().default(false),
    form: taskNoteForm('form').notNull().default('words'),
    anchor: jsonb('anchor').$type<AnchorRow>(),
    approval: jsonb('approval').$type<ApprovalRow>(),
    failure: jsonb('failure').$type<FailureRow>(),
    deferredMove: jsonb('deferred_move').$type<DeferredMoveRow>(),
    connectionAsk: jsonb('connection_ask').$type<ConnectionAskRow>(),
    answeredAt: timestamptz('answered_at'),
    readAt: timestamptz('read_at'),
    acknowledgedAt: timestamptz('acknowledged_at'),
  },
  (table) => [
    check('task_note_position_not_negative', sql`${table.position} >= 0`),
    primaryKey({ columns: [table.taskId, table.position] }),
    index('task_note_run_idx').on(table.runId),
    index('task_note_closing_idx')
      .on(table.taskId, table.at)
      .where(sql`${table.closesConversation}`),
    index('task_note_connection_ask_idx')
      .on(
        sql`(${table.connectionAsk}->>'personId')`,
        sql`(${table.connectionAsk}->>'integration')`,
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
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('task_attachment_place_not_negative', sql`${table.place} >= 0`),
    check('task_attachment_size_not_negative', sql`${table.size} >= 0`),
    index('task_attachment_task_idx').on(table.taskId, table.notePosition),
  ],
);

export const taskMark = pgTable(
  'task_mark',
  {
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
    heldSince: timestamptz('held_since').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'task_mark_task_fk',
      columns: [table.workspaceId, table.taskId],
      foreignColumns: [task.workspaceId, task.id],
    }).onDelete('cascade'),
    primaryKey({ columns: [table.taskId, table.kind, table.value] }),
    index('task_mark_mark_idx').on(table.workspaceId, table.kind, table.value),
  ],
);
