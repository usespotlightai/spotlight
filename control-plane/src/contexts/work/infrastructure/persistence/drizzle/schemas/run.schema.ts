import {
  amount,
  isCurrencyCode,
  literals,
  timestamptz,
} from '@platform/persistence/drizzle/columns';
import {
  RUN_STATES,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { RUN_TURN_STATES } from '@work/domain/value-objects/run-turn.vo';
import type { StartedCheckoutParts } from '@work/domain/value-objects/started-checkout.vo';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
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

export const runTurn = pgEnum('run_turn', RUN_TURN_STATES);

export interface RunTurnReportParts {
  readonly handover: {
    readonly next: string;
    readonly note: string;
    readonly attachments: readonly {
      readonly id: string;
      readonly name: string;
      readonly contentType: string;
      readonly size: number;
    }[];
  } | null;
  readonly session: string | null;
  readonly reportedBy: string;
}

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
    ),
    replayedTaskId: text('replayed_task_id'),
    ranForTeamId: text('ran_for_team_id'),
    teamId: text('team_id'),
    orderFingerprint: text('order_fingerprint'),
    searchId: text('search_id'),
    searchIteration: integer('search_iteration'),
    stationId: text('station_id'),
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
    startedAt: timestamptz('started_at'),
    endedAt: timestamptz('ended_at'),
    startedFromArchiveId: text('started_from_archive_id'),
    startedFromCheckouts: jsonb('started_from_checkouts').$type<
      readonly StartedCheckoutParts[]
    >(),
    startedFromAttempt: integer('started_from_attempt'),
    startedFromAt: timestamptz('started_from_at'),
    askedAPerson: boolean('asked_a_person').notNull().default(false),
    turn: runTurn('turn'),
    turnReport: jsonb('turn_report').$type<RunTurnReportParts>(),
    suspendedAt: timestamptz('suspended_at'),
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
    index('run_team_idx').on(table.teamId, table.createdAt),
    index('run_created_idx').on(table.createdAt, table.id),
    index('run_station_idx').on(table.stationId, table.createdAt),
    index('run_turn_idx').on(table.turn, table.suspendedAt),
    check(
      'run_turn_check',
      sql`(${table.state} = 'suspended') = (${table.turn} is not null) and (${table.turn} is null) = (${table.turnReport} is null) and (${table.turn} is null) = (${table.suspendedAt} is null)`,
    ),
    check(
      'run_ended_at_matches_state',
      sql`(${table.state} in (${literals(TERMINAL_RUN_STATES)})) = (${table.endedAt} is not null)`,
    ),
    unique('run_workspace_id_id_key').on(table.workspaceId, table.id),
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
