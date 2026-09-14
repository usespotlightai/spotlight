import { RUN_STATES } from '@domain/value-objects/run-state';
import { station } from '@infrastructure/persistence/drizzle/schemas/line.schema';
import { workspace } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import {
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
    tokenHash: text('token_hash').notNull(),
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

export const run = pgTable(
  'run',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    harness: text('harness').notNull(),
    priority: integer('priority').default(0).notNull(),
    taskId: text('task_id'),
    stationId: text('station_id').references(() => station.id, {
      onDelete: 'set null',
    }),
    state: runState('state').notNull(),
    spec: jsonb('spec').$type<unknown>().notNull(),
    attempt: integer('attempt').notNull().default(1),
    targetRunnerId: text('target_runner_id').references(() => runner.id, {
      onDelete: 'cascade',
    }),
    claimedBy: text('claimed_by').references(() => runner.id, {
      onDelete: 'set null',
    }),
    leaseExpiresAt: timestamp('lease_expires_at'),
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
  },
  (table) => [primaryKey({ columns: [table.runId, table.seq] })],
);

export const runDigest = pgTable(
  'run_digest',
  {
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    ms: integer('ms'),
    steps: integer('steps').notNull().default(0),
    faults: integer('faults').notNull().default(0),
    used: integer('used'),
    size: integer('size'),
    cost: doublePrecision('cost'),
    currency: text('currency'),
    digestedAt: timestamp('digested_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.attempt] })],
);
