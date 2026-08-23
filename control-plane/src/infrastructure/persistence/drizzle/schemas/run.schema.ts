import { RUN_STATES } from '@domain/value-objects/run-state';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const runState = pgEnum('run_state', RUN_STATES);

export const runner = pgTable(
  'runner',
  {
    id: text('id').primaryKey(),
    pool: text('pool').notNull(),
    labels: jsonb('labels').$type<Record<string, string>>().notNull(),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  },
  (table) => [index('runner_pool_idx').on(table.pool)],
);

/**
 * `spec` is the run's instructions, opaque here on purpose: what a checkout
 * means is the prepare hook's business, so the control plane carries it rather
 * than modelling it.
 */
export const run = pgTable(
  'run',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    pool: text('pool').notNull(),
    state: runState('state').notNull(),
    spec: jsonb('spec').$type<unknown>().notNull(),
    // Rises each time the run goes back on the queue. Without it a second
    // attempt's journal collides with the first, seq for seq, and is dropped.
    attempt: integer('attempt').notNull().default(1),
    claimedBy: text('claimed_by').references(() => runner.id, {
      onDelete: 'set null',
    }),
    leaseExpiresAt: timestamp('lease_expires_at'),
    exitCode: integer('exit_code'),
    message: text('message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // The claim reads exactly this: the oldest queued run in one pool.
    index('run_queue_idx').on(table.pool, table.state, table.createdAt),
    index('run_lease_idx').on(table.leaseExpiresAt),
    index('run_workspace_idx').on(table.workspaceId),
  ],
);

/**
 * A run's journal. `seq` is assigned by the runner and rises without gaps, so
 * a reader that reconnects knows exactly what it missed — and a retried batch
 * collides on the primary key instead of being appended twice.
 */
export const runEvent = pgTable(
  'run_event',
  {
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    at: timestamp('at').notNull(),
    message: text('message'),
    data: text('data'),
    offset: bigint('offset', { mode: 'number' }),
  },
  (table) => [primaryKey({ columns: [table.runId, table.seq] })],
);
