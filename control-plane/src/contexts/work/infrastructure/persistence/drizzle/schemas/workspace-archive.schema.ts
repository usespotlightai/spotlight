import { timestamptz } from '@platform/persistence/drizzle/columns';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
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
    grantedAt: timestamptz('granted_at').notNull(),
    completedAt: timestamptz('completed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('workspace_archive_size_not_negative', sql`${table.size} >= 0`),
    index('workspace_archive_resume_idx').on(
      table.workspaceId,
      table.resumeKey,
      table.completedAt,
    ),
    index('workspace_archive_task_idx').on(table.taskId),
    index('workspace_archive_chat_idx').on(table.chatId),
    index('workspace_archive_granted_to_run_idx').on(table.grantedToRunId),
    foreignKey({
      name: 'workspace_archive_granted_to_run_fk',
      columns: [table.workspaceId, table.grantedToRunId],
      foreignColumns: [run.workspaceId, run.id],
    }),
    check(
      'workspace_archive_granted_to_one',
      sql`(${table.grantedToRunId} is null) <> (${table.grantedToSandboxId} is null)`,
    ),
  ],
);
