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
    // A tar in Spotlight's storage has a size and a SHA-256. A snapshot in a store of the hosts has the store, and the base it descends from.
    size: bigint('size', { mode: 'number' }),
    sha256: text('sha256'),
    snapshotStore: text('snapshot_store'),
    snapshotBase: text('snapshot_base'),
    grantedAt: timestamptz('granted_at').notNull(),
    completedAt: timestamptz('completed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('working_copy_archive_size_not_negative', sql`${table.size} >= 0`),
    check(
      'working_copy_archive_snapshot_base',
      sql`${table.snapshotBase} is null or ${table.snapshotStore} is not null`,
    ),
    check(
      'working_copy_archive_one_location',
      sql`case when ${table.snapshotStore} is null then ${table.size} is not null and ${table.sha256} is not null else ${table.size} is null and ${table.sha256} is null end`,
    ),
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
