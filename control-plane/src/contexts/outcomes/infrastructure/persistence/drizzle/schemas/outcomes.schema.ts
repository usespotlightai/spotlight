import { CHECK_VERDICTS } from '@outcomes/domain/value-objects/check-verdict';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { JUDGING_FAILURES } from '@outcomes/domain/value-objects/judging-failure.vo';
import {
  PERSON_ACTS,
  type PersonAct,
} from '@outcomes/domain/value-objects/next-act.vo';
import { RUN_ENDINGS } from '@outcomes/domain/value-objects/run-ending';
import { SCORE_KINDS } from '@outcomes/domain/value-objects/score-scale.vo';
import { SCORE_SOURCES } from '@outcomes/domain/value-objects/score-source';
import type {
  SeenHunk,
  SeenStep,
} from '@outcomes/domain/value-objects/seen-evidence.vo';
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

const JUDGING_FAILURE_CODES = Object.keys(JUDGING_FAILURES) as [
  keyof typeof JUDGING_FAILURES,
  ...(keyof typeof JUDGING_FAILURES)[],
];

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

export interface StoredRefusal {
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

export interface StoredAct {
  readonly act: PersonAct;
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
}

export const runRecordEnding = pgEnum('run_record_ending', RUN_ENDINGS);
export const runRecordChecks = pgEnum('run_record_checks', CHECK_VERDICTS);
export const runRecordAct = pgEnum('run_record_act', PERSON_ACTS);
export const taskDeliveryState = pgEnum('task_delivery_state', DELIVERY_STATES);
export const pullRequestRecordState = pgEnum(
  'pull_request_record_state',
  DELIVERY_STATES,
);
export const scoreSource = pgEnum('score_source', SCORE_SOURCES);
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
    queuedAt: timestamp('queued_at'),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    ending: runRecordEnding('ending'),
    failure: text('failure'),
    round: integer('round'),
    superseded: boolean('superseded').notNull().default(false),
    checks: runRecordChecks('checks'),
    nextAct: runRecordAct('next_act'),
    nextAt: timestamp('next_at'),
    handedOnTo: text('handed_on_to'),
    handedOnAt: timestamp('handed_on_at'),
    digested: boolean('digested').notNull().default(false),
    ms: integer('ms'),
    steps: integer('steps'),
    faults: integer('faults'),
    used: integer('used'),
    size: integer('size'),
    cost: doublePrecision('cost'),
    currency: text('currency'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }),
    cacheWriteTokens: bigint('cache_write_tokens', { mode: 'number' }),
    tools: jsonb('tools').$type<StoredTools>(),
    refusals: jsonb('refusals').$type<StoredRefusal[]>().notNull().default([]),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('run_record_team_idx').on(table.teamId, table.endedAt),
    index('run_record_station_idx').on(table.stationId, table.endedAt),
    index('run_record_task_idx').on(table.taskId, table.endedAt),
    index('run_record_workspace_idx').on(table.workspaceId),
  ],
);

export const taskDelivery = pgTable(
  'task_delivery',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    state: taskDeliveryState('state').notNull().default('open'),
    openedAt: timestamp('opened_at').notNull(),
    firstReviewAt: timestamp('first_review_at'),
    closedAt: timestamp('closed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_delivery_pull_request_idx').on(
      table.workspaceId,
      table.pullRequest,
    ),
    index('task_delivery_team_idx').on(table.teamId, table.openedAt),
  ],
);

export const pendingReview = pgTable(
  'pending_review',
  {
    workspaceId: text('workspace_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    at: timestamp('at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.pullRequest, table.at],
    }),
  ],
);

export const taskTouches = pgTable(
  'task_touches',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id'),
    lineId: text('line_id'),
    stationId: text('station_id'),
    openedBy: text('opened_by'),
    openedAt: timestamp('opened_at'),
    asks: jsonb('asks').$type<StoredAsk[]>().notNull().default([]),
    acts: jsonb('acts').$type<StoredAct[]>().notNull().default([]),
    touchedAt: timestamp('touched_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_touches_team_idx').on(table.teamId, table.touchedAt),
    index('task_touches_workspace_idx').on(table.workspaceId),
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
    lastAt: timestamp('last_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_failures_last_idx').on(table.workspaceId, table.lastAt),
    index('task_failures_team_idx').on(table.teamId, table.lastAt),
  ],
);

export const forgottenTask = pgTable(
  'forgotten_task',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
  },
  (table) => [index('forgotten_task_workspace_idx').on(table.workspaceId)],
);

export const forgottenWorkspace = pgTable('forgotten_workspace', {
  workspaceId: text('workspace_id').primaryKey(),
});

export const forgottenTeam = pgTable(
  'forgotten_team',
  {
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.teamId] })],
);

export const forgottenPullRequest = pgTable(
  'forgotten_pull_request',
  {
    workspaceId: text('workspace_id').notNull(),
    pullRequest: text('pull_request').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.pullRequest] }),
    index('forgotten_pull_request_updated_idx').on(table.updatedAt),
  ],
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
    openedAt: timestamp('opened_at'),
    state: pullRequestRecordState('state'),
    closedAt: timestamp('closed_at'),
    updatedAt: timestamp('updated_at'),
    firstReviewAt: timestamp('first_review_at'),
    reviews: integer('reviews').notNull().default(0),
    reviewRounds: integer('review_rounds').notNull().default(0),
    reviewComments: integer('review_comments').notNull().default(0),
    isRevert: boolean('is_revert').notNull().default(false),
    revertedBy: text('reverted_by'),
    seenVersion: integer('seen_version'),
    ownerTaskId: text('owner_task_id'),
    ownerTeamId: text('owner_team_id'),
    reviewTaskIds: text('review_task_ids').array().notNull().default([]),
    githubForgotAt: timestamp('github_forgot_at'),
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
    index('pull_request_record_review_tasks_idx').using(
      'gin',
      table.reviewTaskIds,
    ),
  ],
);

export const taskChangeShape = pgTable(
  'task_change_shape',
  {
    taskId: text('task_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    changeTitles: text('change_titles').array().notNull().default([]),
    changeIntents: text('change_intents').array().notNull().default([]),
    shapedAt: timestamp('shaped_at').notNull(),
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
    startedBy: text('started_by').notNull(),
    startedAt: timestamp('started_at').notNull(),
    version: integer('version').notNull().default(0),
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
    rubric: text('rubric').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    askedAt: timestamp('asked_at').notNull(),
    owed: boolean('owed').notNull(),
    workAttempts: integer('work_attempts').notNull().default(0),
    workDueAt: timestamp('work_due_at'),
    judgedAt: timestamp('judged_at'),
    failure: judgingFailure('failure'),
    failedAt: timestamp('failed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('judging_owed_idx').on(table.askedAt).where(sql`${table.owed}`),
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
    value: integer('value').notNull(),
    rubricVersion: text('rubric_version'),
    model: text('model'),
    reasons: jsonb('reasons').$type<StoredReason[]>().notNull().default([]),
    seen: jsonb('seen')
      .$type<StoredSeen>()
      .notNull()
      .default({ steps: [], hunks: [] }),
    by: text('by'),
    at: timestamp('at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('score_judge_idx')
      .on(table.runId, table.rubricVersion)
      .where(sql`${table.source} = 'judge'`),
    uniqueIndex('score_person_idx')
      .on(table.runId, table.by)
      .where(sql`${table.source} = 'person'`),
    index('score_station_idx').on(table.stationId, table.at),
    index('score_task_idx').on(table.taskId),
    index('score_workspace_idx').on(table.workspaceId, table.teamId),
  ],
);
