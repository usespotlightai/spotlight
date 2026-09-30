import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const workspaceArchive = pgTable(
  'workspace_archive',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    continuityKey: text('continuity_key').notNull(),
    taskId: text('task_id'),
    chatId: text('chat_id'),
    grantedToRunId: text('granted_to_run_id').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    grantedAt: timestamp('granted_at').notNull(),
    sealedAt: timestamp('sealed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('workspace_archive_continuity_idx').on(
      table.workspaceId,
      table.continuityKey,
      table.sealedAt,
    ),
    index('workspace_archive_task_idx').on(table.taskId),
    index('workspace_archive_chat_idx').on(table.chatId),
  ],
);
