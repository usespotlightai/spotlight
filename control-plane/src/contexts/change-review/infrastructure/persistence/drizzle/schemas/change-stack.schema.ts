import {
  CHANGE_STACK_STATES,
  type ChangeStackState,
} from '@change-review/domain/value-objects/stack-progress.vo';
import type {
  StoredCohort,
  StoredFacts,
  StoredFile,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const changeStack = pgTable(
  'change_stack',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    taskId: text('task_id'),
    replay: boolean('replay').notNull().default(false),
    workspaceId: text('workspace_id').notNull(),
    repository: text('repository'),
    baseCommit: text('base_commit'),
    state: changeStackState('state').$type<ChangeStackState>().notNull(),
    files: jsonb('files').$type<StoredFile[]>().notNull(),
    cohorts: jsonb('cohorts').$type<StoredCohort[]>().notNull().default([]),
    failure: text('failure'),
    draftedAt: timestamp('drafted_at').notNull(),
    completedAt: timestamp('completed_at'),
    facts: jsonb('facts').$type<StoredFacts>().notNull(),
    checkCommand: text('check_command'),
    checkSetup: text('check_setup'),
    checkPlacement: jsonb('check_placement')
      .$type<readonly (readonly string[])[]>()
      .notNull()
      .default([]),
    checkPlacementImage: text('check_placement_image'),
    reordering: boolean('reordering').notNull().default(false),
    spent: jsonb('spent').$type<StoredModelUsage>().notNull(),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamp('job_due_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('change_stack_run_idx').on(table.runId, table.draftedAt),
    index('change_stack_task_idx').on(table.taskId, table.draftedAt),
  ],
);
