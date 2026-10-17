import type { BriefedMemoriesParts } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTaskParts } from '@work/domain/value-objects/briefed-task.vo';
import { RUN_STATES } from '@work/domain/value-objects/run-state';
import type { StartedCheckoutParts } from '@work/domain/value-objects/started-checkout.vo';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
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
    taskRevision: integer('task_revision'),
    chatId: text('chat_id'),
    replayOfRunId: text('replay_of_run_id').references(
      (): AnyPgColumn => run.id,
      { onDelete: 'cascade' },
    ),
    ranForTeamId: text('ran_for_team_id'),
    searchId: text('search_id'),
    searchIteration: integer('search_iteration'),
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
    provisionAttempts: integer('provision_attempts').notNull().default(0),
    nextProvisionAttemptAt: timestamp('next_provision_attempt_at'),
    requeueCount: integer('requeue_count').notNull().default(0),
    suspendedAttempts: integer('suspended_attempts')
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    briefedMemories: jsonb('briefed_memories')
      .$type<BriefedMemoriesParts>()
      .notNull()
      .default({ briefed: [], cut: [] }),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    stationFingerprint: text('station_fingerprint'),
    stationConfig: jsonb('station_config').$type<StationConfigParts>(),
    briefedTask: jsonb('briefed_task').$type<BriefedTaskParts>(),
    startedFromArchiveId: text('started_from_archive_id'),
    startedFromCheckouts: jsonb('started_from_checkouts').$type<
      readonly StartedCheckoutParts[]
    >(),
    startedFromAttempt: integer('started_from_attempt'),
    startedFromAt: timestamp('started_from_at'),
    askedAPerson: boolean('asked_a_person').notNull().default(false),
    claimableFrom: timestamp('claimable_from'),
    exitCode: integer('exit_code'),
    message: text('message'),
    failure: text('failure'),
    stopped: boolean('stopped').notNull().default(false),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    queuedAt: timestamp('queued_at').defaultNow().notNull(),
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
    index('run_task_idx').on(table.taskId),
    index('run_station_idx').on(table.stationId, table.createdAt),
    index('run_station_fingerprint_idx').on(table.stationFingerprint),
    check(
      'run_station_config_check',
      sql`(${table.stationConfig} is null) = (${table.stationFingerprint} is null)`,
    ),
    index('run_chat_idx').on(table.chatId),
    index('run_replay_of_idx').on(table.replayOfRunId),
    index('run_search_idx').on(table.searchId),
    index('run_reserved_idx').on(table.reservedFor),
    index('run_started_from_idx').on(
      table.startedFromArchiveId,
      table.startedFromAt,
    ),
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

export interface RunDigestServerCalls {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: readonly number[];
  readonly lastCallFailed: boolean;
}

export interface RunDigestTools {
  readonly servers: readonly RunDigestServerCalls[];
  readonly skills: readonly string[];
}

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
    changedLines: integer('changed_lines').notNull().default(0),
    used: integer('used'),
    size: integer('size'),
    cost: doublePrecision('cost'),
    currency: text('currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    tools: jsonb('tools')
      .$type<RunDigestTools>()
      .notNull()
      .default({ servers: [], skills: [] }),
    digestedAt: timestamp('digested_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.attempt] })],
);
