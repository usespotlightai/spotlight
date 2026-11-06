import {
  amount,
  isCurrencyCode,
  literals,
  timestamptz,
} from '@platform/persistence/drizzle/columns';
import type { BriefedMemoriesParts } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTaskParts } from '@work/domain/value-objects/briefed-task.vo';
import {
  RUN_STATES,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import type { StartedCheckoutParts } from '@work/domain/value-objects/started-checkout.vo';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
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
    leaseExpiresAt: timestamptz('lease_expires_at'),
    stopRequestedAt: timestamptz('stop_requested_at'),
    reservedFor: text('reserved_for'),
    reservedPool: text('reserved_pool'),
    reservedUntil: timestamptz('reserved_until'),
    provisionAttempts: integer('provision_attempts').notNull().default(0),
    nextProvisionAttemptAt: timestamptz('next_provision_attempt_at'),
    requeueCount: integer('requeue_count').notNull().default(0),
    suspendedAttempts: integer('suspended_attempts')
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    briefedMemories: jsonb('briefed_memories')
      .$type<BriefedMemoriesParts>()
      .notNull()
      .default({ briefed: [], omitted: [] }),
    startedAt: timestamptz('started_at'),
    endedAt: timestamptz('ended_at'),
    stationFingerprint: text('station_fingerprint'),
    stationConfig: jsonb('station_config').$type<StationConfigParts>(),
    briefedTask: jsonb('briefed_task').$type<BriefedTaskParts>(),
    startedFromArchiveId: text('started_from_archive_id'),
    startedFromCheckouts: jsonb('started_from_checkouts').$type<
      readonly StartedCheckoutParts[]
    >(),
    startedFromAttempt: integer('started_from_attempt'),
    startedFromAt: timestamptz('started_from_at'),
    askedAPerson: boolean('asked_a_person').notNull().default(false),
    claimableFrom: timestamptz('claimable_from'),
    exitCode: integer('exit_code'),
    message: text('message'),
    failure: text('failure'),
    stopped: boolean('stopped').notNull().default(false),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
    queuedAt: timestamptz('queued_at').defaultNow().notNull(),
    traceparent: text('traceparent'),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      'run_provision_attempts_not_negative',
      sql`${table.provisionAttempts} >= 0`,
    ),
    check('run_requeue_count_not_negative', sql`${table.requeueCount} >= 0`),
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
      'run_ended_at_matches_state',
      sql`(${table.state} in (${literals(TERMINAL_RUN_STATES)})) = (${table.endedAt} is not null)`,
    ),
    check(
      'run_station_config_check',
      sql`(${table.stationConfig} is null) = (${table.stationFingerprint} is null)`,
    ),
    unique('run_workspace_id_id_key').on(table.workspaceId, table.id),
    foreignKey({
      name: 'run_chat_fk',
      columns: [table.workspaceId, table.chatId],
      foreignColumns: [chat.workspaceId, chat.id],
    }),
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
    at: timestamptz('at').notNull(),
    message: text('message'),
    data: text('data'),
  },
  (table) => [primaryKey({ columns: [table.runId, table.attempt, table.seq] })],
);

export interface RunUsageServerCalls {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: readonly number[];
  readonly lastCallFailed: boolean;
}

export interface RunUsageTools {
  readonly servers: readonly RunUsageServerCalls[];
  readonly skills: readonly string[];
}

export const runUsage = pgTable(
  'run_usage',
  {
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    ms: integer('ms'),
    steps: integer('steps').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    changedLines: integer('changed_lines').notNull().default(0),
    contextTokens: integer('context_tokens'),
    contextWindow: integer('context_window'),
    cost: amount('cost'),
    currency: text('currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    tools: jsonb('tools')
      .$type<RunUsageTools>()
      .notNull()
      .default({ servers: [], skills: [] }),
    recordedAt: timestamptz('recorded_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.attempt] }),
    check('run_usage_currency_code', isCurrencyCode(table.currency)),
  ],
);
