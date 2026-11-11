import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export interface InboxAnnouncementRow {
  readonly person: string;
  readonly itemId: string;
  readonly askedAt: string;
}

export const arrivalLedger = pgTable(
  'arrival_ledger',
  {
    workspaceId: text('workspace_id').primaryKey(),
    watching: jsonb('watching').$type<string[]>().notNull(),
    announced: jsonb('announced').$type<InboxAnnouncementRow[]>().notNull(),
    sightedAt: timestamptz('sighted_at'),
    recountRequestedAt: timestamptz('recount_requested_at'),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('arrival_ledger_recount_idx').on(table.recountRequestedAt),
    check(
      'arrival_ledger_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
  ],
);
