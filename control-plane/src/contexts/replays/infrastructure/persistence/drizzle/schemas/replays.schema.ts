import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';
import { RUN_OUTCOMES } from '@replays/domain/value-objects/replay-ending';
import { REPLAY_STATES } from '@replays/domain/value-objects/replay-state';
import { sql } from 'drizzle-orm';
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

export const replayState = pgEnum('replay_state', REPLAY_STATES);

export const replayCandidateKind = pgEnum(
  'replay_candidate_kind',
  CANDIDATE_KINDS,
);

export const replayRunOutcome = pgEnum('replay_run_outcome', RUN_OUTCOMES);

export interface StoredStationChange {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}

export interface StoredModelSpent {
  readonly spends: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpriced: number;
}

export interface StoredEntryChecks {
  readonly state: string;
  readonly failedAt: readonly string[];
  readonly why: string | null;
}

export interface StoredEntryReason {
  readonly code: string;
  readonly detail: string | null;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
}

export interface StoredEntryVerdict {
  readonly scale: string;
  readonly value: number;
  readonly model: string;
  readonly referenced: boolean;
  readonly reasons: readonly {
    readonly text: string;
    readonly steps: readonly number[];
    readonly hunks: readonly string[];
  }[];
}

export interface StoredEntryJudging {
  readonly verdict: StoredEntryVerdict | null;
  readonly unjudged: string | null;
}

export const replaySet = pgTable(
  'replay_set',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull(),
    stationGoneAt: timestamp('station_gone_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_set_station_idx').on(table.stationId),
    index('replay_set_team_idx').on(table.teamId),
    index('replay_set_line_idx').on(table.lineId),
  ],
);

export const replaySetEntry = pgTable(
  'replay_set_entry',
  {
    setId: text('set_id')
      .notNull()
      .references(() => replaySet.id, { onDelete: 'cascade' }),
    runId: text('run_id').notNull(),
    taskId: text('task_id').notNull(),
    addedAt: timestamp('added_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.setId, table.runId] })],
);

export const replayCandidate = pgTable(
  'replay_candidate',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    teamKey: text('team_key').notNull(),
    lineKey: text('line_key').notNull(),
    stationKey: text('station_key').notNull(),
    name: text('name').notNull(),
    kind: replayCandidateKind('kind').notNull(),
    station: jsonb('station').$type<Record<string, unknown>>().notNull(),
    fingerprint: text('fingerprint').notNull(),
    checksChanges: boolean('checks_changes').notNull(),
    rubric: text('rubric'),
    rubricVersion: text('rubric_version'),
    changedFrom: text('changed_from').notNull(),
    changes: jsonb('changes').$type<StoredStationChange[]>().notNull(),
    createdAt: timestamp('created_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_candidate_station_idx').on(table.stationId),
    index('replay_candidate_team_idx').on(table.teamId),
    uniqueIndex('replay_candidate_address_idx')
      .on(table.teamId, table.lineKey, table.stationKey, table.name)
      .where(sql`${table.kind} = 'proposed'`),
  ],
);

export const replay = pgTable(
  'replay',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    setId: text('set_id').notNull(),
    candidateId: text('candidate_id').notNull(),
    baseline: boolean('baseline').notNull(),
    judges: boolean('judges').notNull(),
    checked: boolean('checked').notNull(),
    rubricVersion: text('rubric_version'),
    ceilingAmount: doublePrecision('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    state: replayState('state').notNull(),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    stoppedAt: timestamp('stopped_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_set_idx').on(table.setId),
    index('replay_candidate_idx').on(table.candidateId),
    index('replay_team_state_idx').on(table.teamId, table.state),
  ],
);

export const replayEntry = pgTable(
  'replay_entry',
  {
    replayId: text('replay_id')
      .notNull()
      .references(() => replay.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    originalRunId: text('original_run_id').notNull(),
    taskId: text('task_id').notNull(),
    runId: text('run_id'),
    queued: boolean('queued').notNull().default(false),
    fingerprint: text('fingerprint'),
    queueAttempts: integer('queue_attempts').notNull().default(0),
    refusal: text('refusal'),
    notRun: boolean('not_run').notNull().default(false),
    outcome: replayRunOutcome('outcome'),
    failure: text('failure'),
    stopped: boolean('stopped'),
    asked: boolean('asked'),
    next: text('next'),
    endedAt: timestamp('ended_at'),
    measured: boolean('measured').notNull().default(false),
    ms: doublePrecision('ms'),
    steps: integer('steps'),
    changedLines: integer('changed_lines'),
    costAmount: doublePrecision('cost_amount'),
    costCurrency: text('cost_currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    checks: jsonb('checks').$type<StoredEntryChecks>(),
    draftingSpent: jsonb('drafting_spent').$type<StoredModelSpent>(),
    judgingSpent: jsonb('judging_spent').$type<StoredModelSpent>(),
    judging: jsonb('judging').$type<StoredEntryJudging>(),
    succeeded: boolean('succeeded'),
    reasons: jsonb('reasons')
      .$type<StoredEntryReason[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [
    primaryKey({ columns: [table.replayId, table.position] }),
    uniqueIndex('replay_entry_run_idx').on(table.runId),
  ],
);
