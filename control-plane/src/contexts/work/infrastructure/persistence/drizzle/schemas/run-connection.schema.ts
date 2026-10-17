import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const runConnection = pgTable(
  'run_connection',
  {
    id: serial('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    host: text('host').notNull(),
    port: integer('port').notNull(),
    bytesOut: bigint('bytes_out', { mode: 'number' }).notNull(),
    bytesIn: bigint('bytes_in', { mode: 'number' }).notNull(),
    ms: integer('ms').notNull(),
    outcome: text('outcome').notNull(),
    status: integer('status'),
    reason: text('reason'),
    at: timestamp('at').notNull(),
  },
  (table) => [
    index('run_connection_run_idx').on(table.runId, table.at),
    index('run_connection_at_idx').on(table.at),
  ],
);
