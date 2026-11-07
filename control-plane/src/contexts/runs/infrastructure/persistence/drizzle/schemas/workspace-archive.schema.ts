import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
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
    workspaceKey: text('workspace_key').notNull(),
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
    index('workspace_archive_key_idx').on(
      table.workspaceId,
      table.workspaceKey,
      table.completedAt,
    ),
    index('workspace_archive_granted_idx').on(table.grantedAt, table.id),
    index('workspace_archive_granted_to_run_idx').on(table.grantedToRunId),
    check(
      'workspace_archive_granted_to_one',
      sql`(${table.grantedToRunId} is null) <> (${table.grantedToSandboxId} is null)`,
    ),
  ],
);
