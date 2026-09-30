import { CHECK_VERDICTS } from '@outcomes/domain/value-objects/check-verdict';
import { DELIVERY_STATES } from '@outcomes/domain/value-objects/delivery-state';
import { JUDGING_FAILURES } from '@outcomes/domain/value-objects/judging-failure.vo';
import { PERSON_ACTS } from '@outcomes/domain/value-objects/next-act.vo';
import { RUN_ENDINGS } from '@outcomes/domain/value-objects/run-ending';
import { SCORE_KINDS } from '@outcomes/domain/value-objects/score-scale.vo';
import { SCORE_SOURCES } from '@outcomes/domain/value-objects/score-source';
import type {
  SeenHunk,
  SeenStep,
} from '@outcomes/domain/value-objects/seen-evidence.vo';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const JUDGING_FAILURE_CODES = Object.keys(JUDGING_FAILURES) as [
  keyof typeof JUDGING_FAILURES,
  ...(keyof typeof JUDGING_FAILURES)[],
];

export interface StoredCitation {
  readonly step: number | null;
  readonly hunk: string | null;
}

export interface StoredSeen {
  readonly steps: readonly SeenStep[];
  readonly hunks: readonly SeenHunk[];
}

export interface StoredReason {
  readonly text: string;
  readonly citations: readonly StoredCitation[];
}

export const runRecordEnding = pgEnum('run_record_ending', RUN_ENDINGS);
export const runRecordChecks = pgEnum('run_record_checks', CHECK_VERDICTS);
export const runRecordAct = pgEnum('run_record_act', PERSON_ACTS);
export const taskDeliveryState = pgEnum('task_delivery_state', DELIVERY_STATES);
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
    endedAt: timestamp('ended_at'),
    ending: runRecordEnding('ending'),
    failure: text('failure'),
    round: integer('round'),
    superseded: boolean('superseded').notNull().default(false),
    checks: runRecordChecks('checks'),
    nextAct: runRecordAct('next_act'),
    nextAt: timestamp('next_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
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
    pullRequest: text('pull_request').notNull(),
    state: taskDeliveryState('state').notNull().default('open'),
    closedAt: timestamp('closed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('task_delivery_pull_request_idx').on(
      table.workspaceId,
      table.pullRequest,
    ),
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
