import { BASELINE_STATUSES } from '@replays/domain/value-objects/baseline-status';
import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';
import type { WantedValue } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import {
  CONFIG_PULL_REQUEST_CLOSE_REASONS,
  CONFIG_PULL_REQUEST_ERRORS,
  CONFIG_PULL_REQUEST_STATES,
} from '@replays/domain/value-objects/config-pull-request-state';
import type { FailureCauseKind } from '@replays/domain/value-objects/failure-cause.vo';
import { REFLECTION_RESULTS } from '@replays/domain/value-objects/reflection-result';
import { RUN_RESULTS } from '@replays/domain/value-objects/replay-ending';
import {
  REPLAY_STATES,
  type ReplayStopReason,
} from '@replays/domain/value-objects/replay-state';
import {
  SEARCH_ITERATION_KINDS,
  SEARCH_ITERATION_STATES,
} from '@replays/domain/value-objects/search-iteration.vo';
import { SEARCH_OBJECTIVES } from '@replays/domain/value-objects/search-objective';
import type { SearchPickDecline } from '@replays/domain/value-objects/search-pick';
import { SEARCH_SKIP_REASONS } from '@replays/domain/value-objects/search-skip-reason';
import {
  ACTIVE_SEARCH_STATES,
  SEARCH_STATES,
} from '@replays/domain/value-objects/search-state';
import { SEARCH_STOP_REASONS } from '@replays/domain/value-objects/search-stop-reason';
import { SEARCH_TRIGGERS } from '@replays/domain/value-objects/search-trigger';
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

export const replayRunResult = pgEnum('replay_run_result', RUN_RESULTS);

export const replaySearchState = pgEnum('replay_search_state', SEARCH_STATES);

export const replaySearchStopReason = pgEnum(
  'replay_search_stop_reason',
  SEARCH_STOP_REASONS,
);

export const replaySearchObjective = pgEnum(
  'replay_search_objective',
  SEARCH_OBJECTIVES,
);

export const replaySearchTrigger = pgEnum(
  'replay_search_trigger',
  SEARCH_TRIGGERS,
);

export const searchSkipReason = pgEnum(
  'search_skip_reason',
  SEARCH_SKIP_REASONS,
);

export type StoredSearchPick =
  | { readonly outcome: 'picked'; readonly candidateId: string }
  | { readonly outcome: 'declined'; readonly reason: SearchPickDecline };

export const replaySearchIterationState = pgEnum(
  'replay_search_iteration_state',
  SEARCH_ITERATION_STATES,
);

export const replaySearchReflectionResult = pgEnum(
  'replay_search_reflection_result',
  REFLECTION_RESULTS,
);

export const replaySearchIterationKind = pgEnum(
  'replay_search_iteration_kind',
  SEARCH_ITERATION_KINDS,
);

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
  readonly claimResults: readonly boolean[] | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly model: string;
  readonly referenced: boolean;
  readonly reasons: readonly {
    readonly text: string;
    readonly steps: readonly number[];
    readonly hunks: readonly string[];
    readonly claim: number | null;
  }[];
  readonly guidance: string | null;
}

export interface StoredEntryPairing {
  readonly otherRunId: string;
  readonly verdict: {
    readonly outcome: string;
    readonly model: string;
    readonly passes: readonly {
      readonly ownShownFirst: boolean;
      readonly outcome: string;
      readonly reasons: readonly {
        readonly text: string;
        readonly ownHunks: readonly string[];
        readonly theirHunks: readonly string[];
      }[];
    }[];
  } | null;
  readonly unpaired: string | null;
}

export interface StoredEntryJudging {
  readonly verdict: StoredEntryVerdict | null;
  readonly unjudged: string | null;
}

export interface StoredPlannedLine {
  readonly repositories: readonly Readonly<Record<string, unknown>>[];
}

export interface StoredSplitEntry {
  readonly runId: string;
  readonly taskId: string;
}

export interface StoredSplit {
  readonly searched: readonly StoredSplitEntry[];
  readonly heldOut: readonly StoredSplitEntry[];
}

export interface StoredSearchReplay {
  readonly replayId: string;
  readonly end: ReplayStopReason | null;
  readonly spent: number | null;
  readonly unpriced: number;
}

export interface StoredSearchProposal {
  readonly candidateId: string;
  readonly name: string;
  readonly replay: StoredSearchReplay;
  readonly improved: boolean | null;
}

export interface StoredReflectedTask {
  readonly taskId: string;
  readonly originalRunId: string;
  readonly replayRunId: string;
}

export interface StoredFailureCause extends StoredReflectedTask {
  readonly cause: FailureCauseKind;
  readonly evidence: string;
  readonly suggestion: string | null;
  readonly recordedAt: string;
}

export interface StoredHeldOutReplay {
  readonly candidateId: string;
  readonly replay: StoredSearchReplay;
}

export interface StoredSetRefresh {
  readonly at: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export const replaySet = pgTable(
  'replay_set',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    createdAt: timestamp('created_at').notNull(),
    refreshedAt: timestamp('refreshed_at'),
    lastRefresh: jsonb('last_refresh').$type<StoredSetRefresh>(),
    stationGoneAt: timestamp('station_gone_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('replay_set_station_idx').on(table.stationId),
    index('replay_set_team_idx').on(table.teamId),
    index('replay_set_line_idx').on(table.lineId),
    index('replay_set_refreshed_at_idx').on(table.refreshedAt),
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
    endedAt: timestamp('ended_at').notNull(),
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
    behaviourHash: text('behaviour_hash').notNull(),
    scoringHash: text('scoring_hash').notNull(),
    lineFields: jsonb('line_fields').$type<StoredPlannedLine>(),
    checksChanges: boolean('checks_changes').notNull(),
    rubric: text('rubric'),
    claims: jsonb('claims').$type<string[]>(),
    passThreshold: doublePrecision('pass_threshold'),
    rubricVersion: text('rubric_version'),
    changedFrom: text('changed_from').notNull(),
    changes: jsonb('changes').$type<StoredStationChange[]>().notNull(),
    searchId: text('search_id'),
    iteration: integer('iteration'),
    hypothesis: text('hypothesis'),
    referenceCommit: text('reference_commit'),
    referencePullRequest: integer('reference_pull_request'),
    createdAt: timestamp('created_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_candidate_station_idx').on(table.stationId),
    index('replay_candidate_team_idx').on(table.teamId),
    uniqueIndex('replay_candidate_search_name_idx')
      .on(table.searchId, table.name)
      .where(sql`${table.kind} = 'searched'`),
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
    scoringHash: text('scoring_hash').notNull(),
    ceilingAmount: doublePrecision('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    unpricedRate: doublePrecision('unpriced_rate'),
    runSubset: jsonb('run_subset').$type<string[]>(),
    answers:
      jsonb('answers').$type<
        { run: string; answer: 'accepted' | 'sent-back' }[]
      >(),
    repeats: integer('repeats').notNull(),
    calibration: boolean('calibration').notNull().default(false),
    referenceReplayId: text('reference_replay_id'),
    pairwiseReferenceId: text('pairwise_reference_id'),
    searchId: text('search_id'),
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
    index('replay_team_started_idx').on(table.teamId, table.startedAt),
    index('replay_search_idx').on(table.searchId),
    index('replay_pairwise_reference_idx').on(table.pairwiseReferenceId),
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
    repeat: integer('repeat').notNull(),
    runId: text('run_id'),
    queued: boolean('queued').notNull().default(false),
    fingerprint: text('fingerprint'),
    queueAttempts: integer('queue_attempts').notNull().default(0),
    unreplayableReason: text('unreplayable_reason'),
    notRun: boolean('not_run').notNull().default(false),
    result: replayRunResult('result'),
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
    generationSpent: jsonb('generation_spent').$type<StoredModelSpent>(),
    judgingSpent: jsonb('judging_spent').$type<StoredModelSpent>(),
    judging: jsonb('judging').$type<StoredEntryJudging>(),
    succeeded: boolean('succeeded'),
    reasons: jsonb('reasons')
      .$type<StoredEntryReason[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    secondJudging: jsonb('second_judging').$type<StoredEntryJudging>(),
    rejudgingSpent: jsonb('rejudging_spent').$type<StoredModelSpent>(),
    recheck: jsonb('recheck').$type<StoredEntryChecks>(),
    pairing: jsonb('pairing').$type<StoredEntryPairing>(),
    pairingSpent: jsonb('pairing_spent').$type<StoredModelSpent>(),
  },
  (table) => [
    primaryKey({ columns: [table.replayId, table.position] }),
    uniqueIndex('replay_entry_run_idx').on(table.runId),
  ],
);

export const replaySearch = pgTable(
  'replay_search',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    setId: text('set_id').notNull(),
    harness: text('harness').notNull(),
    model: text('model'),
    effort: text('effort'),
    iterations: integer('iterations').notNull(),
    perIteration: integer('per_iteration').notNull(),
    ceilingAmount: doublePrecision('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    concurrency: integer('concurrency').notNull(),
    repeats: integer('repeats').notNull(),
    objective: replaySearchObjective('objective').notNull(),
    split: jsonb('split').$type<StoredSplit>().notNull(),
    calibrates: boolean('calibrates').notNull(),
    seedCandidateId: text('seed_candidate_id').notNull(),
    seedFingerprint: text('seed_fingerprint').notNull(),
    seedReplay: jsonb('seed_replay').$type<StoredSearchReplay>().notNull(),
    heldOut: jsonb('held_out')
      .$type<StoredHeldOutReplay[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    state: replaySearchState('state').notNull(),
    stopReason: replaySearchStopReason('stop_reason'),
    trigger: replaySearchTrigger('trigger').notNull(),
    pick: jsonb('pick').$type<StoredSearchPick>(),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_search_team_idx').on(table.teamId),
    index('replay_search_set_idx').on(table.setId),
    index('replay_search_line_started_idx').on(table.lineId, table.startedAt),
    uniqueIndex('replay_search_active_idx')
      .on(table.stationId)
      .where(
        sql`${table.state} in (${sql.raw(
          ACTIVE_SEARCH_STATES.map((each) => `'${each}'`).join(', '),
        )})`,
      ),
  ],
);

export const replaySearchIteration = pgTable(
  'replay_search_iteration',
  {
    searchId: text('search_id')
      .notNull()
      .references(() => replaySearch.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    runId: text('run_id').notNull(),
    kind: replaySearchIterationKind('kind').notNull(),
    state: replaySearchIterationState('state').notNull(),
    proposals: jsonb('proposals')
      .$type<StoredSearchProposal[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    attempts: integer('attempts').notNull().default(0),
    agentSpent: jsonb('agent_spent').$type<StoredModelSpent>(),
    incumbent: text('incumbent'),
    result: replaySearchReflectionResult('result'),
    reflectedOn: jsonb('reflected_on')
      .$type<StoredReflectedTask[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    causes: jsonb('causes')
      .$type<StoredFailureCause[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [
    primaryKey({ columns: [table.searchId, table.number] }),
    uniqueIndex('replay_search_iteration_run_idx').on(table.runId),
  ],
);

export const replayCheckBaseline = pgEnum(
  'replay_check_baseline',
  BASELINE_STATUSES,
);

export const replayCheck = pgTable(
  'replay_check',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    stationKey: text('station_key').notNull(),
    setId: text('set_id').notNull(),
    setEntries: text('set_entries').notNull(),
    attempt: integer('attempt').notNull(),
    candidateId: text('candidate_id').notNull(),
    replayId: text('replay_id').notNull(),
    referenceCommit: text('reference_commit'),
    referencePullRequest: integer('reference_pull_request'),
    liveFingerprint: text('live_fingerprint').notNull(),
    candidateFingerprint: text('candidate_fingerprint').notNull(),
    liveBehaviour: text('live_behaviour').notNull(),
    liveScoring: text('live_scoring').notNull(),
    candidateBehaviour: text('candidate_behaviour').notNull(),
    candidateScoring: text('candidate_scoring').notNull(),
    maxRegressions: integer('max_regressions').notNull(),
    minGain: doublePrecision('min_gain').notNull(),
    ceilingAmount: doublePrecision('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    repeats: integer('repeats').notNull(),
    scoringPinnedToLive: jsonb('scoring_pinned_to_live')
      .$type<string[]>()
      .notNull(),
    baseline: replayCheckBaseline('baseline').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [
    index('replay_check_team_idx').on(table.teamId),
    index('replay_check_awaiting_idx')
      .on(table.createdAt)
      .where(sql`${table.baseline} = 'awaiting'`),
    index('replay_check_set_idx').on(table.setId),
    uniqueIndex('replay_check_attempt_idx').on(
      table.stationId,
      table.candidateBehaviour,
      table.liveScoring,
      table.attempt,
    ),
  ],
);

export const configPullRequestState = pgEnum(
  'config_pull_request_state',
  CONFIG_PULL_REQUEST_STATES,
);

export const configPullRequestError = pgEnum(
  'config_pull_request_error',
  CONFIG_PULL_REQUEST_ERRORS,
);

export const configPullRequestCloseReason = pgEnum(
  'config_pull_request_close_reason',
  CONFIG_PULL_REQUEST_CLOSE_REASONS,
);

export const configPullRequest = pgTable(
  'config_pull_request',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    searchId: text('search_id').notNull(),
    candidateId: text('candidate_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    stationKey: text('station_key').notNull(),
    candidateName: text('candidate_name').notNull(),
    repository: text('repository'),
    path: text('path'),
    branch: text('branch').notNull(),
    state: configPullRequestState('state').notNull(),
    url: text('url'),
    number: integer('number'),
    gitHubId: bigint('github_id', { mode: 'number' }),
    basedOn: text('based_on'),
    proposing: text('proposing'),
    checkedAt: timestamp('checked_at'),
    closedBecause: configPullRequestCloseReason('closed_because'),
    closeFailureCode: configPullRequestError('close_failure_code'),
    closeFailureMessage: text('close_failure_message'),
    errorCode: configPullRequestError('error_code'),
    errorMessage: text('error_message'),
    errorAttribute: text('error_attribute'),
    errorExpression: text('error_expression'),
    errorWanted: jsonb('error_wanted').$type<WantedValue>(),
    retries: integer('retries').notNull(),
    lastCommit: text('last_commit'),
    dueAt: timestamp('due_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('config_pull_request_candidate_idx').on(
      table.searchId,
      table.candidateId,
    ),
    index('config_pull_request_team_idx').on(table.teamId),
    index('config_pull_request_station_idx').on(table.stationId),
    uniqueIndex('config_pull_request_github_idx').on(
      table.workspaceId,
      table.gitHubId,
    ),
    uniqueIndex('config_pull_request_number_idx').on(
      table.workspaceId,
      sql`lower(${table.repository})`,
      table.number,
    ),
    uniqueIndex('config_pull_request_open_station_idx')
      .on(table.stationId)
      .where(sql`${table.state} in ('opening', 'opened', 'closing')`),
    index('config_pull_request_check_idx')
      .on(table.checkedAt)
      .where(sql`${table.state} = 'opened'`),
    index('config_pull_request_due_idx')
      .on(table.state, table.dueAt)
      .where(sql`${table.state} in ('opening', 'closing')`),
  ],
);

export const stationSearchSchedule = pgTable(
  'station_search_schedule',
  {
    stationId: text('station_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    setId: text('set_id').notNull(),
    lastStartedAt: timestamp('last_started_at'),
    lastSkipReason: searchSkipReason('last_skip_reason'),
    lastSkipAt: timestamp('last_skip_at'),
    searchedTasks: jsonb('searched_tasks').$type<string[]>().notNull(),
    alertPendingSince: timestamp('alert_pending_since'),
    rejected: jsonb('rejected').$type<string[]>().notNull(),
    rejectedAgainst: text('rejected_against'),
    lastRejectedAt: timestamp('last_rejected_at'),
    lastImprovedAt: timestamp('last_improved_at'),
    checkAfter: timestamp('check_after').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('station_search_schedule_set_idx').on(table.setId),
    index('station_search_schedule_team_idx').on(table.teamId),
    index('station_search_schedule_line_idx').on(table.lineId),
    index('station_search_schedule_check_after_idx').on(table.checkAfter),
  ],
);
