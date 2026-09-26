import { RUN_STATES } from '@work/domain/value-objects/run-state';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import {
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
} from 'drizzle-orm/pg-core';

export const runState = pgEnum('run_state', RUN_STATES);

export const run = pgTable(
  'run',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    harness: text('harness').notNull(),
    priority: integer('priority').default(0).notNull(),
    taskId: text('task_id'),
    chatId: text('chat_id'),
    stationId: text('station_id').references(() => station.id, {
      onDelete: 'set null',
    }),
    state: runState('state').notNull(),
    spec: jsonb('spec').$type<unknown>().notNull(),
    attempt: integer('attempt').notNull().default(1),
    placement: jsonb('placement')
      .$type<readonly (readonly string[])[]>()
      .notNull()
      .default([]),
    placementImage: text('placement_image'),
    ranIn: text('ran_in'),
    claimedBy: text('claimed_by'),
    leaseExpiresAt: timestamp('lease_expires_at'),
    stopRequestedAt: timestamp('stop_requested_at'),
    reservedFor: text('reserved_for'),
    reservedPool: text('reserved_pool'),
    reservedUntil: timestamp('reserved_until'),
    provisionFailures: integer('provision_failures').notNull().default(0),
    nextProvisionAt: timestamp('next_provision_at'),
    handBacks: integer('hand_backs').notNull().default(0),
    claimableFrom: timestamp('claimable_from'),
    exitCode: integer('exit_code'),
    message: text('message'),
    stopped: boolean('stopped').notNull().default(false),
    version: integer('version').notNull().default(0),
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
    index('run_lease_idx').on(table.leaseExpiresAt),
    index('run_workspace_idx').on(table.workspaceId),
    index('run_chat_idx').on(table.chatId),
    index('run_reserved_idx').on(table.reservedFor),
  ],
);

export const runJournalEntry = pgTable(
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
  (table) => [primaryKey({ columns: [table.runId, table.attempt, table.seq] })],
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
