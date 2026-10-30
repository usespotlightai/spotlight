import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
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
    resumeKey: text('resume_key').notNull(),
    taskId: text('task_id'),
    chatId: text('chat_id'),
    grantedToRunId: text('granted_to_run_id'),
    grantedToSandboxId: text('granted_to_sandbox_id'),
    size: bigint('size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    grantedAt: timestamp('granted_at').notNull(),
    completedAt: timestamp('completed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('workspace_archive_resume_idx').on(
      table.workspaceId,
      table.resumeKey,
      table.completedAt,
    ),
    index('workspace_archive_task_idx').on(table.taskId),
    index('workspace_archive_chat_idx').on(table.chatId),
    check(
      'workspace_archive_granted_to_one',
      sql`(${table.grantedToRunId} is null) <> (${table.grantedToSandboxId} is null)`,
    ),
  ],
);
