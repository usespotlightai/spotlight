import {
  amount,
  isCurrencyCode,
  timestamptz,
} from '@platform/persistence/drizzle/columns';
import { BASELINE_STATUSES } from '@replays/domain/value-objects/baseline-status';
import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';
import type { ChecksState } from '@replays/domain/value-objects/change-checks.vo';
import type { WantedValue } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import {
  CONFIG_PULL_REQUEST_CLOSE_REASONS,
  CONFIG_PULL_REQUEST_ERRORS,
  CONFIG_PULL_REQUEST_STATES,
} from '@replays/domain/value-objects/config-pull-request-state';
import type { PairOutcome } from '@replays/domain/value-objects/entry-pairing.vo';
import type { FailureCauseKind } from '@replays/domain/value-objects/failure-cause.vo';
import { PAIR_ORDERS } from '@replays/domain/value-objects/pair-order';
import { REFLECTION_RESULTS } from '@replays/domain/value-objects/reflection-result';
import {
  type ReplayEnding,
  RUN_RESULTS,
} from '@replays/domain/value-objects/replay-ending';
import { REPLAY_RUN_DECISIONS } from '@replays/domain/value-objects/replay-run-decided';
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
import {
  SEARCH_SKIP_REASONS,
  type SearchSkipReason,
} from '@replays/domain/value-objects/search-skip-reason';
import { SEARCH_STATES } from '@replays/domain/value-objects/search-state';
import { SEARCH_STOP_REASONS } from '@replays/domain/value-objects/search-stop-reason';
import { SEARCH_TRIGGERS } from '@replays/domain/value-objects/search-trigger';
import { UNREPLAYABLE_REASONS } from '@replays/domain/value-objects/unreplayable-reason';
import type { JudgeScaleKind } from '@shared-kernel/domain/value-objects/judge-scale.vo';
import { JUDGING_FAILURE_CODES } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import { sql } from 'drizzle-orm';
import {
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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const replayState = pgEnum('replay_state', REPLAY_STATES);
export const unreplayableReason = pgEnum(
  'unreplayable_reason',
  UNREPLAYABLE_REASONS,
);

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
  readonly started: boolean;
  readonly end: ReplayStopReason | null;
  readonly spent: number | null;
  readonly unpriced: number;
}

export interface StoredSearchProposal {
  readonly candidateId: string;
  readonly name: string;
  readonly replay: StoredSearchReplay;
  readonly improved: boolean | null;
  readonly requestedBy: string | null;
}

export interface StoredSearchRequest {
  readonly candidateId: string;
  readonly name: string;
  readonly requestedBy: string;
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

export interface StoredOutcomeChecks {
  readonly state: ChecksState;
  readonly pending: boolean;
}

export interface StoredOutcomeEntry {
  readonly position: number;
  readonly original: string;
  readonly taskId: string;
  readonly repeat: number;
  readonly run: string | null;
  readonly hasEnded: boolean;
  readonly ending: ReplayEnding | null;
  readonly concluded: boolean;
  readonly succeeded: boolean | null;
  readonly reasons: readonly StoredEntryReason[];
  readonly measures: {
    readonly steps: number;
    readonly ms: number | null;
    readonly cost: {
      readonly amount: number;
      readonly currency: string;
    } | null;
  } | null;
  readonly verdict: {
    readonly value: number;
    readonly scale: JudgeScaleKind;
    readonly referenced: boolean;
  } | null;
  readonly pair: PairOutcome | null;
  readonly secondJudging: { readonly pending: boolean } | null;
  readonly judgeAgreed: boolean | null;
  readonly checks: StoredOutcomeChecks | null;
  readonly recheck: StoredOutcomeChecks | null;
  readonly checksFlipped: boolean | null;
  readonly spent: StoredModelSpent;
}

export interface StoredReplayOutcome {
  readonly repeats: number;
  readonly calibration: boolean;
  readonly rubricVersion: string | null;
  readonly currency: string;
  readonly runSubset: readonly string[] | null;
  readonly referenceReplayId: string | null;
  readonly pairwiseReferenceId: string | null;
  readonly originals: readonly string[];
  readonly entries: readonly StoredOutcomeEntry[];
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
    createdAt: timestamptz('created_at').notNull(),
    refreshedAt: timestamptz('refreshed_at'),
    lastRefresh: jsonb('last_refresh').$type<StoredSetRefresh>(),
    stationGoneAt: timestamptz('station_gone_at'),
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
    endedAt: timestamptz('ended_at').notNull(),
    addedAt: timestamptz('added_at').notNull(),
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
    createdAt: timestamptz('created_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_candidate_station_idx').on(table.stationId),
    index('replay_candidate_team_idx').on(table.teamId),
    index('replay_candidate_search_idx').on(table.searchId),
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
    liveCandidate: boolean('live_candidate').notNull(),
    baseline: boolean('baseline').notNull(),
    takesPairings: boolean('takes_pairings').notNull(),
    judges: boolean('judges').notNull(),
    checked: boolean('checked').notNull(),
    rubricVersion: text('rubric_version'),
    scoringHash: text('scoring_hash').notNull(),
    ceilingAmount: amount('ceiling_amount').notNull(),
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
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at'),
    stoppedAt: timestamptz('stopped_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'replay_ceiling_currency_code',
      isCurrencyCode(table.ceilingCurrency),
    ),
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
    pool: text('pool').notNull(),
    slot: integer('slot'),
    queued: boolean('queued').notNull().default(false),
    fingerprint: text('fingerprint'),
    queueAttempts: integer('queue_attempts').notNull().default(0),
    unreplayableReason: unreplayableReason('unreplayable_reason'),
    notRun: boolean('not_run').notNull().default(false),
    waiting: boolean('waiting').notNull(),
    occupying: boolean('occupying').notNull(),
    unconfirmed: boolean('unconfirmed').notNull(),
    result: replayRunResult('result'),
    failure: text('failure'),
    stopped: boolean('stopped'),
    asked: boolean('asked'),
    next: text('next'),
    endedAt: timestamptz('ended_at'),
    measured: boolean('measured').notNull().default(false),
    ms: doublePrecision('ms'),
    steps: integer('steps'),
    changedLines: integer('changed_lines'),
    costAmount: amount('cost_amount'),
    costCurrency: text('cost_currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    checks: jsonb('checks').$type<StoredEntryChecks>(),
    generationSpent: jsonb('generation_spent').$type<StoredModelSpent>(),
    judging: jsonb('judging').$type<StoredEntryJudging>(),
    succeeded: boolean('succeeded'),
    reasons: jsonb('reasons')
      .$type<StoredEntryReason[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    secondJudging: jsonb('second_judging').$type<StoredEntryJudging>(),
    recheck: jsonb('recheck').$type<StoredEntryChecks>(),
    pairing: jsonb('pairing').$type<StoredEntryPairing>(),
  },
  (table) => [
    check('replay_entry_position_not_negative', sql`${table.position} >= 0`),
    check(
      'replay_entry_queue_attempts_not_negative',
      sql`${table.queueAttempts} >= 0`,
    ),
    check(
      'replay_entry_cost_currency_code',
      isCurrencyCode(table.costCurrency),
    ),
    primaryKey({ columns: [table.replayId, table.position] }),
    uniqueIndex('replay_entry_run_idx').on(table.runId),
    uniqueIndex('replay_entry_slot_idx')
      .on(table.pool, table.slot)
      .where(sql`${table.occupying}`),
  ],
);

export const replayOutcome = pgTable(
  'replay_outcome',
  {
    replayId: text('replay_id')
      .primaryKey()
      .references(() => replay.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    setId: text('set_id').notNull(),
    candidateId: text('candidate_id').notNull(),
    searchId: text('search_id'),
    state: replayState('state').notNull(),
    servesAsBaseline: boolean('serves_as_baseline').notNull(),
    healthSampleGroup: text('health_sample_group'),
    sampledAt: timestamptz('sampled_at').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at'),
    outcome: jsonb('outcome').$type<StoredReplayOutcome>().notNull(),
  },
  (table) => [
    index('replay_outcome_team_started_idx').on(table.teamId, table.startedAt),
    index('replay_outcome_set_baseline_idx')
      .on(table.setId, table.startedAt)
      .where(sql`${table.servesAsBaseline}`),
    index('replay_outcome_set_health_sample_idx')
      .on(table.setId, table.healthSampleGroup, table.sampledAt)
      .where(sql`${table.healthSampleGroup} is not null`),
    index('replay_outcome_search_idx').on(table.searchId),
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
    harness: text('harness'),
    model: text('model'),
    effort: text('effort'),
    iterations: integer('iterations').notNull(),
    perIteration: integer('per_iteration').notNull(),
    ceilingAmount: amount('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    concurrency: integer('concurrency').notNull(),
    repeats: integer('repeats').notNull(),
    agentRuns: boolean('agent_runs').notNull(),
    objective: replaySearchObjective('objective').notNull(),
    split: jsonb('split').$type<StoredSplit>().notNull(),
    calibrates: boolean('calibrates').notNull(),
    seedCandidateId: text('seed_candidate_id').notNull(),
    seedFingerprint: text('seed_fingerprint').notNull(),
    seedReplay: jsonb('seed_replay').$type<StoredSearchReplay>().notNull(),
    requests: jsonb('requests')
      .$type<StoredSearchRequest[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    droppedRequests: jsonb('dropped_requests')
      .$type<StoredSearchRequest[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    heldOut: jsonb('held_out')
      .$type<StoredHeldOutReplay[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    state: replaySearchState('state').notNull(),
    stopReason: replaySearchStopReason('stop_reason'),
    trigger: replaySearchTrigger('trigger').notNull(),
    pick: jsonb('pick').$type<StoredSearchPick>(),
    awaitsReplays: boolean('awaits_replays').notNull(),
    awaitsAgentSpend: boolean('awaits_agent_spend').notNull(),
    active: boolean('active').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'replay_search_ceiling_currency_code',
      isCurrencyCode(table.ceilingCurrency),
    ),
    index('replay_search_team_idx').on(table.teamId),
    index('replay_search_set_idx').on(table.setId),
    index('replay_search_line_started_idx').on(table.lineId, table.startedAt),
    uniqueIndex('replay_search_active_idx')
      .on(table.stationId)
      .where(sql`${table.active}`),
  ],
);

export const replaySearchIteration = pgTable(
  'replay_search_iteration',
  {
    searchId: text('search_id')
      .notNull()
      .references(() => replaySearch.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    runId: text('run_id'),
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
    check(
      'replay_search_iteration_attempts_not_negative',
      sql`${table.attempts} >= 0`,
    ),
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
    change: text('change').notNull(),
    maxRegressions: integer('max_regressions').notNull(),
    minGain: doublePrecision('min_gain').notNull(),
    ceilingAmount: amount('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    repeats: integer('repeats').notNull(),
    scoringPinnedToLive: jsonb('scoring_pinned_to_live')
      .$type<string[]>()
      .notNull(),
    baseline: replayCheckBaseline('baseline').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'replay_check_ceiling_currency_code',
      isCurrencyCode(table.ceilingCurrency),
    ),
    index('replay_check_team_idx').on(table.teamId),
    index('replay_check_awaiting_idx')
      .on(table.createdAt)
      .where(sql`${table.baseline} = 'awaiting'`),
    index('replay_check_set_idx').on(table.setId),
    uniqueIndex('replay_check_attempt_idx').on(
      table.stationId,
      table.change,
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
    open: boolean('open').notNull(),
    url: text('url'),
    number: integer('number'),
    hostId: bigint('host_id', { mode: 'number' }),
    basedOn: text('based_on'),
    proposing: text('proposing'),
    checkedAt: timestamptz('checked_at'),
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
    dueAt: timestamptz('due_at'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'config_pull_request_retries_not_negative',
      sql`${table.retries} >= 0`,
    ),
    uniqueIndex('config_pull_request_candidate_idx').on(
      table.searchId,
      table.candidateId,
    ),
    index('config_pull_request_team_idx').on(table.teamId),
    index('config_pull_request_station_idx').on(table.stationId),
    uniqueIndex('config_pull_request_host_idx').on(
      table.workspaceId,
      table.hostId,
    ),
    uniqueIndex('config_pull_request_number_idx').on(
      table.workspaceId,
      sql`lower(${table.repository})`,
      table.number,
    ),
    uniqueIndex('config_pull_request_open_station_idx')
      .on(table.stationId)
      .where(sql`${table.open}`),
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
    lastStartedAt: timestamptz('last_started_at'),
    lastSkipReason: searchSkipReason('last_skip_reason'),
    lastSkipAt: timestamptz('last_skip_at'),
    searchedTasks: jsonb('searched_tasks').$type<string[]>().notNull(),
    alertPendingSince: timestamptz('alert_pending_since'),
    rejected: jsonb('rejected').$type<string[]>().notNull(),
    rejectedAgainst: text('rejected_against'),
    lastRejectedAt: timestamptz('last_rejected_at'),
    lastImprovedAt: timestamptz('last_improved_at'),
    requestDay: text('request_day'),
    requests: jsonb('requests').$type<string[]>().notNull(),
    pendingSteps: jsonb('pending_steps')
      .$type<StoredPendingSearchStep[]>()
      .notNull(),
    stepsPendingSince: timestamptz('steps_pending_since'),
    checkAfter: timestamptz('check_after').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('station_search_schedule_set_idx').on(table.setId),
    index('station_search_schedule_team_idx').on(table.teamId),
    index('station_search_schedule_line_idx').on(table.lineId),
    index('station_search_schedule_check_after_idx').on(table.checkAfter),
    index('station_search_schedule_steps_pending_idx')
      .on(table.stepsPendingSince)
      .where(sql`${table.stepsPendingSince} is not null`),
  ],
);

export interface StoredSearchAdmission {
  readonly searchId: string;
  readonly amount: number;
  readonly currency: string;
  readonly admittedAt: string;
}

export interface StoredPendingSearchStep {
  readonly kind: 'start' | 'join';
  readonly searchId: string;
  readonly at: string;
  readonly request: string | null;
  readonly candidates: string[];
  readonly searched: string[];
  readonly addedTasks: string[];
  readonly replaced: {
    readonly lastStartedAt: string | null;
    readonly lastSkipReason: SearchSkipReason | null;
    readonly lastSkipAt: string | null;
    readonly alertPendingSince: string | null;
    readonly checkAfter: string;
    readonly startedCheckAfter: string;
  } | null;
}

export const lineSearchBudget = pgTable(
  'line_search_budget',
  {
    lineId: text('line_id').notNull(),
    month: timestamptz('month').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    admissions: jsonb('admissions').$type<StoredSearchAdmission[]>().notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.lineId, table.month] }),
    index('line_search_budget_team_idx').on(table.teamId),
  ],
);

export const replayJudgingFailure = pgEnum(
  'replay_judging_failure',
  JUDGING_FAILURE_CODES,
);

export const pairOrder = pgEnum('pair_order', PAIR_ORDERS);

export const changeJudging = pgTable(
  'change_judging',
  {
    runId: text('run_id').notNull(),
    attempt: integer('attempt').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    rubric: text('rubric'),
    claims: jsonb('claims').$type<string[]>().notNull(),
    passThreshold: doublePrecision('pass_threshold').notNull(),
    referenceRunId: text('reference_run_id'),
    queuedAt: timestamptz('queued_at').notNull(),
    pending: boolean('pending').notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    judgedAt: timestamptz('judged_at'),
    failure: replayJudgingFailure('failure'),
    failedAt: timestamptz('failed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'change_judging_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
    primaryKey({ columns: [table.runId, table.attempt] }),
    index('change_judging_pending_idx')
      .on(table.queuedAt)
      .where(sql`${table.pending}`),
    index('change_judging_team_idx').on(table.teamId),
  ],
);

export const sideBySideJudging = pgTable(
  'side_by_side_judging',
  {
    runId: text('run_id').notNull(),
    otherRunId: text('other_run_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    rubric: text('rubric'),
    claims: jsonb('claims').$type<string[]>().notNull(),
    passThreshold: doublePrecision('pass_threshold').notNull(),
    referenceRunId: text('reference_run_id').notNull(),
    shownOrder: pairOrder('shown_order').notNull(),
    queuedAt: timestamptz('queued_at').notNull(),
    pending: boolean('pending').notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    judgedAt: timestamptz('judged_at'),
    failure: replayJudgingFailure('failure'),
    failedAt: timestamptz('failed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'side_by_side_judging_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
    primaryKey({ columns: [table.runId, table.otherRunId] }),
    index('side_by_side_judging_pending_idx')
      .on(table.queuedAt)
      .where(sql`${table.pending}`),
    index('side_by_side_judging_team_idx').on(table.teamId),
  ],
);

export const replayRunDecided = pgEnum(
  'replay_run_decided',
  REPLAY_RUN_DECISIONS,
);

export const replayRunDecision = pgTable(
  'replay_run_decision',
  {
    runId: text('run_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    replayId: text('replay_id').notNull(),
    decided: replayRunDecided('decided').notNull(),
    unreplayableReason: unreplayableReason('unreplayable_reason'),
    trialFingerprint: text('trial_fingerprint'),
    movesOnAfter: jsonb('moves_on_after').$type<string[]>(),
    decidedAt: timestamptz('decided_at').defaultNow().notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_run_decision_team_idx').on(table.teamId),
    index('replay_run_decision_replay_idx').on(table.replayId),
    check(
      'replay_run_decision_unreplayable_reason',
      sql`(${table.decided} = 'unreplayable') = (${table.unreplayableReason} is not null)`,
    ),
  ],
);
