import { RUN_STATES } from '@domain/value-objects/run-state';
import { station } from '@infrastructure/persistence/drizzle/schemas/assembly-line.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const runState = pgEnum('run_state', RUN_STATES);

export const runner = pgTable(
  'runner',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // Only the hash: the token itself is shown once, at enrolment, and is not
    // recoverable afterwards.
    tokenHash: text('token_hash').notNull(),
    // Reported by the runner: the ids it found, and the models each advertises.
    harnesses: jsonb('harnesses').$type<string[]>().notNull().default([]),
    advertisedModels: jsonb('advertised_models')
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    revokedAt: timestamp('revoked_at'),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at'),
  },
  (table) => [uniqueIndex('runner_token_hash_idx').on(table.tokenHash)],
);

/**
 * `spec` is the run's instructions, kept opaque: what a checkout means is the
 * prepare hook's business, so the control plane carries it without modelling
 * it.
 */
export const run = pgTable(
  'run',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    // Kept beside the run so the claim is one indexed read on one table.
    harness: text('harness').notNull(),
    priority: integer('priority').default(0).notNull(),
    taskId: text('task_id'),
    // Where the task stood when this was dispatched. Set null rather than
    // cascading: the run happened, whatever became of the station.
    stationId: text('station_id').references(() => station.id, {
      onDelete: 'set null',
    }),
    state: runState('state').notNull(),
    spec: jsonb('spec').$type<unknown>().notNull(),
    // Rises each time the run goes back on the queue. Without it a second
    // attempt's journal collides with the first, seq for seq, and is dropped.
    attempt: integer('attempt').notNull().default(1),
    targetRunnerId: text('target_runner_id').references(() => runner.id, {
      onDelete: 'cascade',
    }),
    claimedBy: text('claimed_by').references(() => runner.id, {
      onDelete: 'set null',
    }),
    leaseExpiresAt: timestamp('lease_expires_at'),
    // When a person asked the run to stop; null until they do.
    stopRequestedAt: timestamp('stop_requested_at'),
    exitCode: integer('exit_code'),
    message: text('message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Exactly what the claim reads, oldest first among equals.
    index('run_queue_idx').on(
      table.harness,
      table.state,
      table.priority,
      table.createdAt,
    ),
    index('run_target_idx').on(table.targetRunnerId),
    index('run_lease_idx').on(table.leaseExpiresAt),
    index('run_workspace_idx').on(table.workspaceId),
  ],
);

/**
 * A run's journal. `seq` is assigned by the runner and rises without gaps, so
 * a reader that reconnects knows what it missed, and a retried batch collides
 * on the primary key instead of being appended twice.
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

/**
 * What a finished run came to, worked out once from its journal and kept.
 *
 * The journal holds hundreds of entries per run, which is affordable to read
 * for one task and not for a team's worth. A run is immutable once it is over,
 * so this is only ever written once and never has to be invalidated.
 *
 * `cost` is what the harness reported, an estimate rather than an accounting
 * figure, which is why it is held as a float and not as money.
 */
export const runDigest = pgTable(
  'run_digest',
  {
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    ms: integer('ms'),
    steps: integer('steps').notNull().default(0),
    // Steps the agent was told had failed, which is what a reader looks for.
    faults: integer('faults').notNull().default(0),
    used: integer('used'),
    size: integer('size'),
    cost: doublePrecision('cost'),
    currency: text('currency'),
    readable: boolean('readable').notNull().default(true),
    digestedAt: timestamp('digested_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.attempt] })],
);
