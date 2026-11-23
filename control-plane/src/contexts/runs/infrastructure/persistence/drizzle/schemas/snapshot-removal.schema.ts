import { timestamptz } from '@platform/persistence/drizzle/columns';
import { index, pgTable, text } from 'drizzle-orm/pg-core';

// The snapshots of removed archives, named after the archive. Spotlight cannot reach the store of the hosts' working
// copy hook, so a host of the store deletes each one and then forgets it here.
export const snapshotRemoval = pgTable(
  'snapshot_removal',
  {
    archiveId: text('archive_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    store: text('store').notNull(),
    queuedAt: timestamptz('queued_at').notNull(),
  },
  (table) => [
    index('snapshot_removal_store_idx').on(
      table.workspaceId,
      table.store,
      table.queuedAt,
    ),
  ],
);
