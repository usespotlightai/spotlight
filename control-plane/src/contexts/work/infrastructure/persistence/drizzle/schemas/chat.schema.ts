import type { ChatMessageKind } from '@work/domain/entities/chat-message.entity';
import type { ProposalState } from '@work/domain/entities/task-proposal.entity';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface ProposalRow {
  readonly lineId: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly state: ProposalState;
  readonly taskId: string | null;
  readonly settledAt: string | null;
}

export interface TraceRow {
  readonly taskId: string;
  readonly title: string;
  readonly teamId: string;
}

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
    currentRunId: text('current_run_id'),
    sessionId: text('session_id'),
    runnerId: text('runner_id'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
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
    kind: text('kind').$type<ChatMessageKind>().notNull(),
    body: text('body').notNull(),
    at: timestamp('at').notNull(),
    authorId: text('author_id'),
    runId: text('run_id'),
    traces: jsonb('traces').$type<TraceRow[]>().notNull().default([]),
    proposal: jsonb('proposal').$type<ProposalRow>(),
    deliveredAt: timestamp('delivered_at'),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.position] })],
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('chat_attachment_chat_idx').on(table.chatId, table.messagePosition),
  ],
);
