import { timestamptz } from '@platform/persistence/drizzle/columns';
import type { ConnectionError } from '@work/domain/value-objects/run-connection.vo';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { bigint, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const runConnection = pgTable(
  'run_connection',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
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
    error: text('error').$type<ConnectionError>(),
    at: timestamptz('at').notNull(),
  },
  (table) => [
    index('run_connection_run_idx').on(table.runId, table.at),
    index('run_connection_at_idx').on(table.at),
  ],
);
