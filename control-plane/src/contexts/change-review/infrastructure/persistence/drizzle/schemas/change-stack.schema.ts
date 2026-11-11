import {
  CHANGE_STACK_STATES,
  type ChangeStackState,
  STACK_FAILURES,
  type StackFailure,
} from '@change-review/domain/value-objects/stack-progress.vo';
import type {
  StoredCohort,
  StoredFacts,
  StoredFile,
  StoredRemovedLayer,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';

export interface StoredModelUsage {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costs: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpriced: number;
}

export const changeStackState = pgEnum(
  'change_stack_state',
  CHANGE_STACK_STATES,
);

export const changeStackFailure = pgEnum(
  'change_stack_failure',
  STACK_FAILURES,
);

export const changeStack = pgTable(
  'change_stack',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    taskId: text('task_id'),
    teamId: text('team_id'),
    trial: boolean('trial').notNull(),
    workspaceId: text('workspace_id').notNull(),
    repository: text('repository'),
    baseCommit: text('base_commit'),
    state: changeStackState('state').$type<ChangeStackState>().notNull(),
    files: jsonb('files').$type<StoredFile[]>().notNull(),
    cohorts: jsonb('cohorts').$type<StoredCohort[]>().notNull(),
    failure: changeStackFailure('failure').$type<StackFailure>(),
    startedAt: timestamptz('started_at').notNull(),
    completedAt: timestamptz('completed_at'),
    facts: jsonb('facts').$type<StoredFacts>().notNull(),
    checkCommand: text('check_command'),
    checkSetup: text('check_setup'),
    checkPlacement: jsonb('check_placement')
      .$type<readonly (readonly string[])[]>()
      .notNull(),
    checkPlacementImage: text('check_placement_image'),
    redrafting: boolean('redrafting').notNull(),
    pendingJob: boolean('pending_job').notNull(),
    usage: jsonb('usage').$type<StoredModelUsage>().notNull(),
    previousStackId: text('previous_stack_id'),
    removedLayers: jsonb('removed_layers')
      .$type<StoredRemovedLayer[]>()
      .notNull(),
    jobAttempts: integer('job_attempts').notNull(),
    jobDueAt: timestamptz('job_due_at'),
    version: integer('version').notNull(),
  },
  (table) => [
    check(
      'change_stack_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
    index('change_stack_run_idx').on(table.runId, table.startedAt),
    index('change_stack_task_idx').on(table.taskId, table.startedAt),
    index('change_stack_team_idx').on(table.teamId),
    index('change_stack_pending_job_idx').on(table.pendingJob, table.jobDueAt),
  ],
);
