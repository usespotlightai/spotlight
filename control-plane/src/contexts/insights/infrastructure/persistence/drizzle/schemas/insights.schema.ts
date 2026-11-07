import { RUN_SIZES } from '@insights/domain/services/run-size';
import {
  PULL_REQUEST_AUTHORS,
  ROUND_BUCKETS,
} from '@insights/domain/services/team-pull-requests';
import {
  ALERT_CONDITIONS,
  ALERT_MEASURES,
} from '@insights/domain/value-objects/alert-rule.vo';
import { CHECK_VERDICTS } from '@insights/domain/value-objects/check-verdict';
import {
  type HumanActionKind,
  TASK_ACTIONS,
} from '@insights/domain/value-objects/human-action.vo';
import { PULL_REQUEST_STATES } from '@insights/domain/value-objects/pull-request-state';
import { PULL_REQUEST_TYPES } from '@insights/domain/value-objects/pull-request-type';
import { RUN_ENDINGS } from '@insights/domain/value-objects/run-ending';
import { SCORE_KINDS } from '@insights/domain/value-objects/score-scale.vo';
import { SCORE_SOURCES } from '@insights/domain/value-objects/score-source';
import type {
  SeenHunk,
  SeenStep,
} from '@insights/domain/value-objects/seen-evidence.vo';
import type { BotActivity } from '@insights/domain/value-objects/seen-pull-request.vo';
import {
  amount,
  isCurrencyCode,
  timestamptz,
} from '@platform/persistence/drizzle/columns';
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

export interface StoredServerCalls {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: readonly number[];
  readonly lastCallFailed: boolean;
}

export interface StoredTools {
  readonly servers: readonly StoredServerCalls[];
  readonly skillsRead: readonly string[];
}

export interface StoredMemories {
  readonly briefed: readonly string[];
  readonly recalled: readonly string[];
}

export interface StoredDismissal {
  readonly tool: string;
  readonly server: string | null;
  readonly at: string;
}

export interface StoredCitation {
  readonly step: number | null;
  readonly hunk: string | null;
}

export interface StoredSeen {
  readonly steps: readonly SeenStep[];
  readonly hunks: readonly SeenHunk[];
}

export interface StoredAsk {
  readonly stationId: string;
  readonly at: string;
}

export interface StoredHumanAction {
  readonly kind: HumanActionKind;
  readonly by: string;
  readonly stationId: string;
  readonly at: string;
}

export interface StoredOccurrence {
  readonly stationId: string;
  readonly runId: string | null;
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
  readonly at: string;
}

export interface StoredReason {
  readonly text: string;
  readonly citations: readonly StoredCitation[];
  readonly claim: number | null;
}

export const runRecordEnding = pgEnum('run_record_ending', RUN_ENDINGS);
export const runRecordChecks = pgEnum('run_record_checks', CHECK_VERDICTS);
export const humanAction = pgEnum('human_action', TASK_ACTIONS);
export const pullRequestState = pgEnum(
  'pull_request_state',
  PULL_REQUEST_STATES,
);
export const pullRequestType = pgEnum('pull_request_type', PULL_REQUEST_TYPES);
export const pullRequestAuthor = pgEnum(
  'pull_request_author',
  PULL_REQUEST_AUTHORS,
);
export const reviewRoundBucket = pgEnum('review_round_bucket', ROUND_BUCKETS);
export const runSize = pgEnum('run_size', RUN_SIZES);
export const scoreSource = pgEnum('score_source', SCORE_SOURCES);
export const alertMeasure = pgEnum('alert_measure', ALERT_MEASURES);
export const alertCondition = pgEnum('alert_condition', ALERT_CONDITIONS);
export const scoreKind = pgEnum('score_kind', SCORE_KINDS);
export const judgingFailure = pgEnum('judging_failure', JUDGING_FAILURE_CODES);

export const runRecord = pgTable(
  'run_record',
  {
    runId: text('run_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id'),
    lineId: text('line_id'),
    stationId: text('station_id'),
    taskId: text('task_id'),
    fingerprint: text('fingerprint'),
    harness: text('harness'),
    model: text('model'),
    effort: text('effort'),
    profileKey: text('profile_key'),
    repositories: jsonb('repositories').$type<string[]>(),
    skills: jsonb('skills').$type<string[]>(),
    queuedAt: timestamptz('queued_at'),
    startedAt: timestamptz('started_at'),
    endedAt: timestamptz('ended_at'),
    ending: runRecordEnding('ending'),
    failure: text('failure'),
    visit: integer('visit'),
    asked: boolean('asked').notNull().default(false),
    supersededAt: timestamptz('superseded_at'),
    checks: runRecordChecks('checks'),
    checkedAt: timestamptz('checked_at'),
    firstHumanAction: humanAction('first_human_action'),
    firstHumanActionAt: timestamptz('first_human_action_at'),
    approvalAnsweredAt: timestamptz('approval_answered_at'),
    passedTo: text('passed_to'),
    passedAt: timestamptz('passed_at'),
    usageRecorded: boolean('usage_recorded').notNull().default(false),
    ms: integer('ms'),
    steps: integer('steps'),
    errors: integer('errors'),
    changedLines: integer('changed_lines'),
    contextTokens: integer('context_tokens'),
    contextWindow: integer('context_window'),
    cost: amount('cost'),
    currency: text('currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    tools: jsonb('tools').$type<StoredTools>(),
    dismissals: jsonb('dismissals')
      .$type<StoredDismissal[]>()
      .notNull()
      .default([]),
    memories: jsonb('memories')
      .$type<StoredMemories>()
      .notNull()
      .default({ briefed: [], recalled: [] }),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('run_record_currency_code', isCurrencyCode(table.currency)),
    index('run_record_team_idx').on(table.teamId, table.endedAt),
    index('run_record_task_idx').on(table.taskId, table.endedAt),
    index('run_record_workspace_idx').on(table.workspaceId),
    index('run_record_ended_idx').on(table.endedAt),
  ],
);

export const runFact = pgTable(
  'run_fact',
  {
    runId: text('run_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    taskId: text('task_id').notNull(),
    fingerprint: text('fingerprint'),
    harness: text('harness').notNull(),
    model: text('model'),
    effort: text('effort'),
    profileKey: text('profile_key'),
    repositories: jsonb('repositories').$type<string[]>().notNull(),
    skills: jsonb('skills').$type<string[]>().notNull(),
    queuedAt: timestamptz('queued_at'),
    startedAt: timestamptz('started_at'),
    endedAt: timestamptz('ended_at').notNull(),
    beganAt: timestamptz('began_at').notNull(),
    endedAs: runRecordEnding('ended_as').notNull(),
    ending: runRecordEnding('ending').notNull(),
    ran: boolean('ran').notNull(),
    ranAConfig: boolean('ran_a_config').notNull(),
    size: runSize('size'),
    failure: text('failure'),
    visit: integer('visit').notNull(),
    asked: boolean('asked').notNull(),
    supersededAt: timestamptz('superseded_at'),
    checks: runRecordChecks('checks'),
    checkedAt: timestamptz('checked_at'),
    firstHumanAction: humanAction('first_human_action'),
    firstHumanActionAt: timestamptz('first_human_action_at'),
    approvalAnsweredAt: timestamptz('approval_answered_at'),
    passedTo: text('passed_to'),
    passedAt: timestamptz('passed_at'),
    usageRecorded: boolean('usage_recorded').notNull(),
    ms: integer('ms'),
    steps: integer('steps'),
    errors: integer('errors'),
    changedLines: integer('changed_lines'),
    contextTokens: integer('context_tokens'),
    contextWindow: integer('context_window'),
    cost: amount('cost'),
    currency: text('currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    tools: jsonb('tools').$type<StoredTools>(),
    dismissals: jsonb('dismissals').$type<StoredDismissal[]>().notNull(),
    memories: jsonb('memories').$type<StoredMemories>().notNull(),
    openedById: text('opened_by_id'),
    taskOpenedAt: timestamptz('task_opened_at'),
    pullRequest: text('pull_request'),
    pullRequestState: pullRequestState('pull_request_state'),
    pullRequestOpenedAt: timestamptz('pull_request_opened_at'),
    pullRequestClosedAt: timestamptz('pull_request_closed_at'),
  },
  (table) => [
    check('run_fact_currency_code', isCurrencyCode(table.currency)),
    index('run_fact_team_ended_idx').on(
      table.workspaceId,
      table.teamId,
      table.endedAt,
    ),
    index('run_fact_ended_idx').on(table.endedAt),
    index('run_fact_station_began_idx').on(
      table.workspaceId,
      table.teamId,
      table.stationId,
      table.beganAt,
      sql`${table.runId} collate "C"`,
    ),
    index('run_fact_station_ended_idx').on(
      table.workspaceId,
      table.teamId,
      table.stationId,
      table.endedAt,
    ),
    index('run_fact_config_idx')
      .on(
        table.teamId,
        table.stationId,
        table.beganAt,
        sql`${table.runId} collate "C"`,
      )
      .where(sql`${table.ranAConfig}`),
    index('run_fact_task_idx').on(table.taskId),
  ],
);

export const taskPullRequestFact = pgTable(
  'task_pull_request_fact',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    state: pullRequestState('state').notNull(),
    openedAt: timestamptz('opened_at').notNull(),
    firstReviewAt: timestamptz('first_review_at'),
    closedAt: timestamptz('closed_at'),
  },
  (table) => [
    index('task_pull_request_fact_team_idx').on(
      table.workspaceId,
      table.teamId,
      table.openedAt,
    ),
  ],
);

export const taskHumanAction = pgTable(
  'task_human_action',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id'),
    lineId: text('line_id'),
    stationId: text('station_id'),
    openedById: text('opened_by_id'),
    openedAt: timestamptz('opened_at'),
    asks: jsonb('asks').$type<StoredAsk[]>().notNull().default([]),
    actions: jsonb('actions')
      .$type<StoredHumanAction[]>()
      .notNull()
      .default([]),
    lastActionAt: timestamptz('last_action_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_human_action_team_idx').on(table.teamId, table.lastActionAt),
    index('task_human_action_workspace_idx').on(table.workspaceId),
  ],
);

export const taskFailures = pgTable(
  'task_failures',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    occurrences: jsonb('occurrences')
      .$type<StoredOccurrence[]>()
      .notNull()
      .default([]),
    lastAt: timestamptz('last_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_failures_last_idx').on(table.workspaceId, table.lastAt),
    index('task_failures_team_idx').on(table.teamId, table.lastAt),
  ],
);

export const deletedTask = pgTable(
  'deleted_task',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
  },
  (table) => [index('deleted_task_workspace_idx').on(table.workspaceId)],
);

export const deletedWorkspace = pgTable('deleted_workspace', {
  workspaceId: text('workspace_id').primaryKey(),
});

export const deletedTeam = pgTable(
  'deleted_team',
  {
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.teamId] })],
);

export const pullRequestRecord = pgTable(
  'pull_request_record',
  {
    workspaceId: text('workspace_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    repository: text('repository'),
    number: integer('number'),
    title: text('title'),
    author: text('author'),
    authorIsBot: boolean('author_is_bot').notNull().default(false),
    branch: text('branch'),
    additions: integer('additions'),
    deletions: integer('deletions'),
    changedFiles: integer('changed_files'),
    openedAt: timestamptz('opened_at'),
    state: pullRequestState('state'),
    closedAt: timestamptz('closed_at'),
    updatedAt: timestamptz('updated_at'),
    readyForReviewAt: timestamptz('ready_for_review_at'),
    draftPeriods: jsonb('draft_periods')
      .$type<{ from: string; to: string | null }[]>()
      .notNull()
      .default([]),
    firstReviewAt: timestamptz('first_review_at'),
    firstUnblockingReviewAt: timestamptz('first_unblocking_review_at'),
    firstApprovedAt: timestamptz('first_approved_at'),
    humanReviewedAt: timestamptz('human_reviewed_at')
      .array()
      .notNull()
      .default([]),
    reviews: integer('reviews').notNull().default(0),
    reviewRounds: integer('review_rounds').notNull().default(0),
    reviewComments: integer('review_comments').notNull().default(0),
    botActivity: jsonb('bot_activity')
      .$type<BotActivity[]>()
      .notNull()
      .default([]),
    isRevert: boolean('is_revert').notNull().default(false),
    revertedBy: text('reverted_by'),
    seenVersion: integer('seen_version'),
    ownerTaskId: text('owner_task_id'),
    ownerTeamId: text('owner_team_id'),
    ownerOpenedAt: timestamptz('owner_opened_at'),
    reviewTaskIds: text('review_task_ids').array().notNull().default([]),
    githubPurgedAt: timestamptz('github_purged_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.pullRequest] }),
    index('pull_request_record_opened_idx').on(
      table.workspaceId,
      table.openedAt,
    ),
    index('pull_request_record_repository_idx').on(
      table.workspaceId,
      table.repository,
    ),
    index('pull_request_record_owner_idx').on(table.ownerTaskId),
    index('pull_request_record_team_idx').on(table.ownerTeamId),
    index('pull_request_record_purged_idx').on(table.githubPurgedAt),
    index('pull_request_record_review_tasks_idx').using(
      'gin',
      table.reviewTaskIds,
    ),
  ],
);

export const pullRequestFact = pgTable(
  'pull_request_fact',
  {
    workspaceId: text('workspace_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    type: pullRequestType('type').notNull(),
    madeBy: pullRequestAuthor('made_by').notNull(),
    rounds: reviewRoundBucket('rounds').notNull(),
    mergedAt: timestamptz('merged_at'),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.pullRequest] })],
);

export const taskChangeShape = pgTable(
  'task_change_shape',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    changeTitles: text('change_titles').array().notNull().default([]),
    changeIntents: text('change_intents').array().notNull().default([]),
    shapedAt: timestamptz('shaped_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_change_shape_team_idx').on(table.workspaceId, table.teamId),
  ],
);

export const chatRecord = pgTable(
  'chat_record',
  {
    chatId: text('chat_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    startedById: text('started_by_id').notNull(),
    startedAt: timestamptz('started_at').notNull(),
  },
  (table) => [
    index('chat_record_team_idx').on(table.teamId, table.startedAt),
    index('chat_record_workspace_idx').on(table.workspaceId),
  ],
);

export const judging = pgTable(
  'judging',
  {
    runId: text('run_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    taskId: text('task_id').notNull(),
    fingerprint: text('fingerprint'),
    rubric: text('rubric'),
    claims: jsonb('claims').$type<string[]>().notNull(),
    passThreshold: doublePrecision('pass_threshold').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    queuedAt: timestamptz('queued_at').notNull(),
    pending: boolean('pending').notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    judgedAt: timestamptz('judged_at'),
    failure: judgingFailure('failure'),
    failedAt: timestamptz('failed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('judging_job_attempts_not_negative', sql`${table.jobAttempts} >= 0`),
    index('judging_pending_idx')
      .on(table.queuedAt)
      .where(sql`${table.pending}`),
    index('judging_task_idx').on(table.taskId),
    index('judging_workspace_idx').on(table.workspaceId, table.teamId),
  ],
);

export const score = pgTable(
  'score',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    taskId: text('task_id').notNull(),
    fingerprint: text('fingerprint'),
    source: scoreSource('source').notNull(),
    kind: scoreKind('kind').notNull(),
    value: doublePrecision('value').notNull(),
    claimResults: jsonb('claim_results').$type<boolean[]>(),
    rubricVersion: text('rubric_version'),
    model: text('model'),
    reasons: jsonb('reasons').$type<StoredReason[]>().notNull().default([]),
    seen: jsonb('seen')
      .$type<StoredSeen>()
      .notNull()
      .default({ steps: [], hunks: [] }),
    scoredById: text('scored_by_id'),
    at: timestamptz('at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('score_judge_idx')
      .on(table.runId, table.rubricVersion)
      .where(sql`${table.source} = 'judge'`),
    uniqueIndex('score_person_idx')
      .on(table.runId, table.scoredById)
      .where(sql`${table.source} = 'person'`),
    index('score_station_idx').on(table.stationId, table.at),
    index('score_task_idx').on(table.taskId),
    index('score_workspace_idx').on(table.workspaceId, table.teamId),
  ],
);

export const stationAlertState = pgTable(
  'station_alert_state',
  {
    stationId: text('station_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('station_alert_state_team_idx').on(table.workspaceId, table.teamId),
  ],
);

export const stationAlert = pgTable(
  'station_alert',
  {
    id: text('id').primaryKey(),
    stationId: text('station_id')
      .notNull()
      .references(() => stationAlertState.stationId, { onDelete: 'cascade' }),
    measure: alertMeasure('measure').notNull(),
    condition: alertCondition('condition').notNull(),
    threshold: doublePrecision('threshold').notNull(),
    over: integer('over').notNull(),
    value: doublePrecision('value').notNull(),
    baseline: doublePrecision('baseline'),
    runId: text('run_id').notNull(),
    taskId: text('task_id').notNull(),
    firedAt: timestamptz('fired_at').notNull(),
    resolvedAt: timestamptz('resolved_at'),
    clearRuns: integer('clear_runs').notNull().default(0),
    lastSeenRunId: text('last_seen_run_id'),
  },
  (table) => [
    check(
      'station_alert_clear_runs_not_negative',
      sql`${table.clearRuns} >= 0`,
    ),
    index('station_alert_station_idx').on(table.stationId, table.firedAt),
    index('station_alert_task_idx').on(table.taskId),
    uniqueIndex('station_alert_open_rule_idx')
      .on(table.stationId, table.measure, table.condition)
      .where(sql`${table.resolvedAt} is null`),
  ],
);
