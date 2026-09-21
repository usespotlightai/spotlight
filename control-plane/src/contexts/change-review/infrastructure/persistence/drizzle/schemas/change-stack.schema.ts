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
    workspaceId: text('workspace_id').notNull(),
    repository: text('repository'),
    baseCommit: text('base_commit'),
    state: changeStackState('state').$type<ChangeStackState>().notNull(),
    files: jsonb('files').$type<StoredFile[]>().notNull(),
    cohorts: jsonb('cohorts').$type<StoredCohort[]>().notNull().default([]),
    failure: text('failure'),
    draftedAt: timestamp('drafted_at').notNull(),
    settledAt: timestamp('settled_at'),
    facts: jsonb('facts').$type<StoredFacts>().notNull(),
    checkCommand: text('check_command'),
    checkSetup: text('check_setup'),
    reordering: boolean('reordering').notNull().default(false),
    workAttempts: integer('work_attempts').notNull().default(0),
    workDueAt: timestamp('work_due_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('change_stack_run_idx').on(table.runId, table.draftedAt),
    index('change_stack_task_idx').on(table.taskId, table.draftedAt),
  ],
);
