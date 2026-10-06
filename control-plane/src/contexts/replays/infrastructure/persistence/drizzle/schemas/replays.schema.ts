import { BASELINE_STANDINGS } from '@replays/domain/value-objects/baseline-standing';
import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';
import type { WantedValue } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import {
  CONFIG_PULL_REQUEST_REFUSALS,
  CONFIG_PULL_REQUEST_STATES,
} from '@replays/domain/value-objects/config-pull-request-state';
import { REFLECTION_OUTCOMES } from '@replays/domain/value-objects/reflection-outcome';
import { RUN_OUTCOMES } from '@replays/domain/value-objects/replay-ending';
import {
  REPLAY_STATES,
  type ReplayEnd,
} from '@replays/domain/value-objects/replay-state';
import type { SearchCauseKind } from '@replays/domain/value-objects/search-cause.vo';
import { SEARCH_ENDINGS } from '@replays/domain/value-objects/search-ending';
import {
  SEARCH_ITERATION_KINDS,
  SEARCH_ITERATION_STATES,
} from '@replays/domain/value-objects/search-iteration.vo';
import { SEARCH_OBJECTIVES } from '@replays/domain/value-objects/search-objective';
import {
  ACTIVE_SEARCH_STATES,
  SEARCH_STATES,
} from '@replays/domain/value-objects/search-state';
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

export const replaySearchState = pgEnum('replay_search_state', SEARCH_STATES);

export const replaySearchEnding = pgEnum(
  'replay_search_ending',
  SEARCH_ENDINGS,
);

export const replaySearchObjective = pgEnum(
  'replay_search_objective',
  SEARCH_OBJECTIVES,
);

export const replaySearchIterationState = pgEnum(
  'replay_search_iteration_state',
  SEARCH_ITERATION_STATES,
);

export const replaySearchReflectionOutcome = pgEnum(
  'replay_search_reflection_outcome',
  REFLECTION_OUTCOMES,
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
  readonly marks: readonly boolean[] | null;
  readonly claims: readonly string[];
  readonly passShare: number;
  readonly model: string;
  readonly referenced: boolean;
  readonly reasons: readonly {
    readonly text: string;
    readonly steps: readonly number[];
    readonly hunks: readonly string[];
    readonly claim: number | null;
  }[];
}

export interface StoredEntryPairing {
  readonly against: string;
  readonly verdict: {
    readonly outcome: string;
    readonly model: string;
    readonly readings: readonly {
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
  readonly end: ReplayEnd | null;
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

export interface StoredSearchCause extends StoredReflectedTask {
  readonly cause: SearchCauseKind;
  readonly evidence: string;
  readonly suggestion: string | null;
  readonly recordedAt: string;
}

export interface StoredHeldOutReplay {
  readonly candidateId: string;
  readonly replay: StoredSearchReplay;
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
    guardsChanges: boolean('guards_changes').notNull().default(false),
    createdAt: timestamp('created_at').notNull(),
    stationGoneAt: timestamp('station_gone_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_set_station_idx').on(table.stationId),
    index('replay_set_team_idx').on(table.teamId),
    index('replay_set_line_idx').on(table.lineId),
    uniqueIndex('replay_set_guards_changes_idx')
      .on(table.stationId)
      .where(sql`${table.guardsChanges}`),
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
    behaviourDigest: text('behaviour_digest').notNull(),
    scoringDigest: text('scoring_digest').notNull(),
    lineFields: jsonb('line_fields').$type<StoredPlannedLine>(),
    checksChanges: boolean('checks_changes').notNull(),
    rubric: text('rubric'),
    claims: jsonb('claims').$type<string[]>(),
    passShare: doublePrecision('pass_share'),
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
    uniqueIndex('replay_candidate_address_idx')
      .on(table.teamId, table.lineKey, table.stationKey, table.name)
      .where(sql`${table.kind} = 'proposed'`),
    uniqueIndex('replay_candidate_search_name_idx')
      .on(table.searchId, table.name)
      .where(sql`${table.kind} = 'searched'`),
  ],
);

export const withdrawnOriginCandidate = pgTable(
  'withdrawn_origin_candidate',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [
    index('withdrawn_origin_candidate_station_idx').on(table.stationId),
    index('withdrawn_origin_candidate_team_idx').on(table.teamId),
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
    scoringDigest: text('scoring_digest').notNull(),
    ceilingAmount: doublePrecision('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    unpricedRate: doublePrecision('unpriced_rate'),
    among: jsonb('among').$type<string[]>(),
    repeats: integer('repeats').notNull(),
    probe: boolean('probe').notNull().default(false),
    comparedWith: text('compared_with'),
    pairsWith: text('pairs_with'),
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
    index('replay_pairs_with_idx').on(table.pairsWith),
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
    seedCandidateId: text('seed_candidate_id').notNull(),
    seedFingerprint: text('seed_fingerprint').notNull(),
    seedReplay: jsonb('seed_replay').$type<StoredSearchReplay>().notNull(),
    heldOut: jsonb('held_out')
      .$type<StoredHeldOutReplay[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    state: replaySearchState('state').notNull(),
    ending: replaySearchEnding('ending'),
    startedBy: text('started_by'),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('replay_search_team_idx').on(table.teamId),
    index('replay_search_set_idx').on(table.setId),
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
    standing: text('standing'),
    outcome: replaySearchReflectionOutcome('outcome'),
    reflectedOn: jsonb('reflected_on')
      .$type<StoredReflectedTask[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    causes: jsonb('causes')
      .$type<StoredSearchCause[]>()
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
  BASELINE_STANDINGS,
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
    mostRegressions: integer('most_regressions').notNull(),
    minGain: doublePrecision('min_gain').notNull(),
    ceilingAmount: doublePrecision('ceiling_amount').notNull(),
    ceilingCurrency: text('ceiling_currency').notNull(),
    repeats: integer('repeats').notNull(),
    keptLive: jsonb('kept_live').$type<string[]>().notNull(),
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

export const configPullRequestRefusal = pgEnum(
  'config_pull_request_refusal',
  CONFIG_PULL_REQUEST_REFUSALS,
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
    refusal: configPullRequestRefusal('refusal'),
    refusalMessage: text('refusal_message'),
    refusalAttribute: text('refusal_attribute'),
    refusalExpression: text('refusal_expression'),
    refusalWanted: jsonb('refusal_wanted').$type<WantedValue>(),
    attempts: integer('attempts').notNull(),
    tries: integer('tries').notNull(),
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
    index('config_pull_request_due_idx')
      .on(table.dueAt)
      .where(sql`${table.state} = 'opening'`),
  ],
);
