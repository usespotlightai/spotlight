import { timestamptz } from '@platform/persistence/drizzle/columns';
import { CHAT_MESSAGE_KINDS } from '@work/domain/entities/chat-message.entity';
import type { ProposalState } from '@work/domain/entities/task-proposal.entity';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
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

export interface ProposalRow {
  readonly lineId: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly state: ProposalState;
  readonly taskId: string | null;
  readonly decidedAt: string | null;
}

export interface TraceRow {
  readonly taskId: string;
  readonly title: string;
  readonly teamId: string;
}

export interface ChatCiRow {
  readonly defaultBranch: string;
  readonly defaultBranchProtected: boolean;
  readonly pullRequestsTrustId: string;
  readonly defaultBranchTrustId: string;
  readonly variables: 'written' | 'not-permitted';
}

export interface ChatSetupRow {
  readonly repository: string;
  readonly folder: string;
  readonly pullRequest: string | null;
  readonly ci?: ChatCiRow | null;
}

export interface TargetStationRow {
  readonly lineId: string;
  readonly lineKey: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly stationName: string;
}

export const chatMessageKind = pgEnum('chat_message_kind', CHAT_MESSAGE_KINDS);

export const chat = pgTable(
  'chat',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    startedById: text('started_by_id').notNull(),
    title: text('title').notNull(),
    harness: text('harness').notNull(),
    model: text('model'),
    effort: text('effort'),
    repositories: jsonb('repositories').$type<string[]>().notNull().default([]),
    targetStation: jsonb('target_station').$type<TargetStationRow>(),
    setup: jsonb('setup').$type<ChatSetupRow>(),
    currentRunId: text('current_run_id'),
    sessionId: text('session_id'),
    runnerId: text('runner_id'),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('chat_workspace_id_id_key').on(table.workspaceId, table.id),
    index('chat_team_starter_idx').on(
      table.teamId,
      table.startedById,
      table.updatedAt,
    ),
  ],
);

export const chatMessage = pgTable(
  'chat_message',
  {
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: chatMessageKind('kind').notNull(),
    body: text('body').notNull(),
    at: timestamptz('at').notNull(),
    authorId: text('author_id'),
    runId: text('run_id').references(() => run.id),
    traces: jsonb('traces').$type<TraceRow[]>().notNull().default([]),
    proposal: jsonb('proposal').$type<ProposalRow>(),
    acknowledgedAt: timestamptz('acknowledged_at'),
    acknowledgedByRunId: text('acknowledged_by_run_id'),
  },
  (table) => [
    check('chat_message_position_not_negative', sql`${table.position} >= 0`),
    primaryKey({ columns: [table.chatId, table.position] }),
    index('chat_message_run_idx').on(table.runId),
  ],
);

export const chatAttachment = pgTable(
  'chat_attachment',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    messagePosition: integer('message_position').notNull(),
    place: integer('place').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('chat_attachment_place_not_negative', sql`${table.place} >= 0`),
    check('chat_attachment_size_not_negative', sql`${table.size} >= 0`),
    index('chat_attachment_chat_idx').on(table.chatId, table.messagePosition),
  ],
);

export const chatMark = pgTable(
  'chat_mark',
  {
    workspaceId: text('workspace_id').notNull(),
    chatId: text('chat_id').notNull(),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
    finds: boolean('finds').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'chat_mark_chat_fk',
      columns: [table.workspaceId, table.chatId],
      foreignColumns: [chat.workspaceId, chat.id],
    }).onDelete('cascade'),
    primaryKey({ columns: [table.chatId, table.kind, table.value] }),
    uniqueIndex('chat_mark_finding_uidx')
      .on(table.workspaceId, table.kind, table.value)
      .where(sql`${table.finds}`),
  ],
);
