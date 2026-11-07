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

export const workingCopyArchive = pgTable(
  'working_copy_archive',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    workingCopyKey: text('working_copy_key').notNull(),
    grantedToRunId: text('granted_to_run_id'),
    grantedToSandboxId: text('granted_to_sandbox_id'),
    size: bigint('size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    grantedAt: timestamptz('granted_at').notNull(),
    completedAt: timestamptz('completed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('working_copy_archive_size_not_negative', sql`${table.size} >= 0`),
    index('working_copy_archive_key_idx').on(
      table.workspaceId,
      table.workingCopyKey,
      table.completedAt,
    ),
    index('working_copy_archive_granted_idx').on(table.grantedAt, table.id),
    index('working_copy_archive_granted_to_run_idx').on(table.grantedToRunId),
    check(
      'working_copy_archive_granted_to_one',
      sql`(${table.grantedToRunId} is null) <> (${table.grantedToSandboxId} is null)`,
    ),
  ],
);
