import { timestamptz } from '@platform/persistence/drizzle/columns';
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export const turnRetake = pgTable(
  'turn_retake',
  {
    runId: text('run_id').notNull(),
    suspendedAt: timestamptz('suspended_at').notNull(),
    attempt: integer('attempt').notNull(),
    checkedAt: timestamptz('checked_at').notNull(),
    retakeDue: boolean('retake_due').notNull().default(false),
    retakeTries: integer('retake_tries').notNull().default(0),
    retakeLeasedUntil: timestamptz('retake_leased_until'),
  },
  (table) => [primaryKey({ columns: [table.runId, table.suspendedAt] })],
);
