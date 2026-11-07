import { timestamptz } from '@platform/persistence/drizzle/columns';
import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

export const turnRetake = pgTable(
  'turn_retake',
  {
    runId: text('run_id').notNull(),
    suspendedAt: timestamptz('suspended_at').notNull(),
    checkedAt: timestamptz('checked_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.suspendedAt] })],
);
