import { LABEL_SOURCES } from '@insights/domain/value-objects/label-source';
import type { RevisionAgreement } from '@insights/domain/services/revision-pick';
import { REVISION_TRIGGERS } from '@insights/domain/services/revision-trigger';
import type { ClaimAnswerKind } from '@insights/domain/value-objects/claim-answer.vo';
import { DISAGREEMENT_DIRECTIONS } from '@insights/domain/value-objects/disagreement-direction';
import {
  REVISION_END_REASONS,
  REVISION_OUTCOME_KINDS,
} from '@insights/domain/value-objects/revision-outcome.vo';
import { WITHDRAWAL_REASONS } from '@insights/domain/value-objects/withdrawal-reason';
import type { StoredReason } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
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

export interface StoredClaimAnswer {
  readonly claim: number;
  readonly answer: ClaimAnswerKind;
  readonly note: string | null;
  readonly by: string;
  readonly at: string;
}

export interface StoredNotMetAnswer {
  readonly shouldHaveFailed: number | null;
  readonly note: string | null;
  readonly by: string;
  readonly at: string;
}

export const judgeDisagreementDirection = pgEnum(
  'judge_disagreement_direction',
  DISAGREEMENT_DIRECTIONS,
);
export const judgeLabelSource = pgEnum('judge_label_source', LABEL_SOURCES);
export const judgeDisagreementWithdrawalReason = pgEnum(
  'judge_disagreement_withdrawal_reason',
  WITHDRAWAL_REASONS,
);
export const claimsRevisionTrigger = pgEnum(
  'claims_revision_trigger',
  REVISION_TRIGGERS,
);
export const claimsRevisionOutcome = pgEnum(
  'claims_revision_outcome',
  REVISION_OUTCOME_KINDS,
);
export const claimsRevisionEndReason = pgEnum(
  'claims_revision_end_reason',
  REVISION_END_REASONS,
);

export const judgeDisagreement = pgTable(
  'judge_disagreement',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    taskId: text('task_id').notNull(),
    scoreId: text('score_id').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    direction: judgeDisagreementDirection('direction').notNull(),
    claims: jsonb('claims').$type<string[]>().notNull(),
    claimResults: jsonb('claim_results').$type<boolean[]>().notNull(),
    reasons: jsonb('reasons').$type<StoredReason[]>().notNull().default([]),
    labelFrom: judgeLabelSource('label_from').notNull(),
    askedOfId: text('asked_of_id'),
    openedAt: timestamptz('opened_at').notNull(),
    claimAnswers: jsonb('claim_answers')
      .$type<StoredClaimAnswer[]>()
      .notNull()
      .default([]),
    notMet: jsonb('not_met').$type<StoredNotMetAnswer>(),
    answeredAt: timestamptz('answered_at'),
    withdrawnAt: timestamptz('withdrawn_at'),
    withdrawnBecause: judgeDisagreementWithdrawalReason('withdrawn_because'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'judge_disagreement_withdrawal_whole',
      sql`(${table.withdrawnAt} is null) = (${table.withdrawnBecause} is null)`,
    ),
    uniqueIndex('judge_disagreement_open_run_idx')
      .on(table.runId)
      .where(sql`${table.withdrawnAt} is null`),
    index('judge_disagreement_run_idx').on(table.runId),
    index('judge_disagreement_station_idx').on(
      table.stationId,
      table.rubricVersion,
      table.answeredAt,
    ),
    index('judge_disagreement_task_idx').on(table.taskId),
    index('judge_disagreement_workspace_idx').on(table.workspaceId, table.teamId),
  ],
);

export const claimsRevision = pgTable(
  'claims_revision',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    stationId: text('station_id').notNull(),
    claims: jsonb('claims').$type<string[]>().notNull(),
    passThreshold: doublePrecision('pass_threshold').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    trigger: claimsRevisionTrigger('trigger').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    pending: boolean('pending').notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    judgeCalls: integer('judge_calls').notNull().default(0),
    pickedClaims: jsonb('picked_claims').$type<string[]>(),
    pickedAgreement: jsonb('picked_agreement').$type<RevisionAgreement>(),
    pickedAt: timestamptz('picked_at'),
    outcome: claimsRevisionOutcome('outcome'),
    endReason: claimsRevisionEndReason('end_reason'),
    proposedClaims: jsonb('proposed_claims').$type<string[]>(),
    pullRequest: text('pull_request'),
    agreement: jsonb('agreement').$type<RevisionAgreement>(),
    message: text('message'),
    endedAt: timestamptz('ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'claims_revision_judge_calls_not_negative',
      sql`${table.judgeCalls} >= 0`,
    ),
    uniqueIndex('claims_revision_open_idx')
      .on(table.stationId)
      .where(sql`${table.endedAt} is null`),
    index('claims_revision_pending_idx')
      .on(table.startedAt)
      .where(sql`${table.pending}`),
    index('claims_revision_station_idx').on(table.stationId, table.startedAt),
    index('claims_revision_workspace_idx').on(table.workspaceId, table.teamId),
  ],
);

export const claimsSource = pgTable(
  'claims_source',
  {
    stationId: text('station_id').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id').notNull(),
    repository: text('repository').notNull(),
    sha: text('sha').notNull(),
    recordedAt: timestamptz('recorded_at').notNull(),
    pullRequestNumber: integer('pull_request_number'),
    pullRequestUrl: text('pull_request_url'),
    pullRequestTitle: text('pull_request_title'),
    resolvedAt: timestamptz('resolved_at'),
    pending: boolean('pending').notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    lookups: integer('lookups').notNull().default(0),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.stationId, table.rubricVersion] }),
    check(
      'claims_source_pending_unresolved',
      sql`${table.pending} = (${table.resolvedAt} is null)`,
    ),
    check(
      'claims_source_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
    check('claims_source_lookups_not_negative', sql`${table.lookups} >= 0`),
    check(
      'claims_source_pull_request_whole',
      sql`(${table.pullRequestNumber} is null) = (${table.pullRequestUrl} is null) and (${table.pullRequestUrl} is null) = (${table.pullRequestTitle} is null)`,
    ),
    check(
      'claims_source_pull_request_resolved',
      sql`${table.pullRequestNumber} is null or ${table.resolvedAt} is not null`,
    ),
    index('claims_source_pending_idx')
      .on(table.recordedAt)
      .where(sql`${table.pending}`),
    index('claims_source_workspace_idx').on(table.workspaceId, table.teamId),
  ],
);
