import {
  amount,
  isCurrencyCode,
  literals,
  timestamptz,
} from '@platform/persistence/drizzle/columns';
import type { JsonValue } from '@shared-kernel/domain/json-value';
import type { RunApiGrantParts } from '@work/domain/value-objects/run-api-grant.vo';
import { RUN_ASKS } from '@work/domain/value-objects/run-policy.vo';
import {
  RUN_STATES,
  TERMINAL_RUN_STATES,
} from '@work/domain/value-objects/run-state';
import { RUN_TURN_STATES } from '@work/domain/value-objects/run-turn.vo';
import type { StartedCheckoutParts } from '@work/domain/value-objects/started-checkout.vo';
import { WORKSPACE_RESTORES } from '@work/domain/value-objects/workspace-key.vo';
import { sql } from 'drizzle-orm';
import {
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

export const runAsks = pgEnum('run_asks', RUN_ASKS);

export const workspaceRestores = pgEnum(
  'workspace_restores',
  WORKSPACE_RESTORES,
);

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
    requesterOwner: text('requester_owner').notNull(),
    requesterKind: text('requester_kind').notNull(),
    requesterId: text('requester_id').notNull(),
    requesterToken: text('requester_token'),
    teamId: text('team_id'),
    holdsTurn: boolean('holds_turn').notNull(),
    gated: boolean('gated').notNull(),
    actsBeyondItself: boolean('acts_beyond_itself').notNull(),
    asks: runAsks('asks').notNull(),
    listed: boolean('listed').notNull(),
    exclusive: boolean('exclusive').notNull(),
    workspaceKey: text('workspace_key'),
    workspaceRejoinable: boolean('workspace_rejoinable'),
    workspaceRestores: workspaceRestores('workspace_restores'),
    restoreArchiveId: text('restore_archive_id'),
    extensions: jsonb('extensions')
      .$type<Readonly<Record<string, JsonValue>>>()
      .notNull()
      .default({}),
    tags: jsonb('tags')
      .$type<Readonly<Record<string, string>>>()
      .notNull()
      .default({}),
    apiGrant: jsonb('api_grant').$type<RunApiGrantParts>(),
    orderFingerprint: text('order_fingerprint'),
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
    index('run_requester_idx').on(
      table.requesterOwner,
      table.requesterKind,
      table.requesterId,
    ),
    index('run_workspace_key_idx').on(table.workspaceId, table.workspaceKey),
    index('run_team_idx').on(table.teamId, table.createdAt),
    index('run_created_idx').on(table.createdAt, table.id),
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
    check(
      'run_workspace_check',
      sql`(${table.workspaceKey} is null) = (${table.workspaceRejoinable} is null) and (${table.workspaceKey} is null) = (${table.workspaceRestores} is null)`,
    ),
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
