import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import type { DiffFile } from '@change-review/domain/value-objects/diff.vo';
import type {
  CheckOutcome,
  CheckPhase,
  StackCheck,
} from '@change-review/domain/value-objects/stack-check.vo';
import type { StackCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  CHANGE_STACK_STATES,
  type ChangeStackState,
} from '@change-review/domain/value-objects/stack-progress.vo';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface StoredStackCheck {
  readonly command: StackCheck['command'];
  readonly entries?: StackCheck['entries'];
  readonly rounds?: number;
  readonly phase: CheckPhase;
  readonly outcome:
    | (Omit<CheckOutcome, 'checkedAt'> & { readonly checkedAt: string })
    | null;
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
    workspaceId: text('workspace_id').notNull(),
    repository: text('repository'),
    state: changeStackState('state').$type<ChangeStackState>().notNull(),
    files: jsonb('files').$type<DiffFile[]>().notNull(),
    cohorts: jsonb('cohorts').$type<StackCohort[]>().notNull().default([]),
    failure: text('failure'),
    draftedAt: timestamp('drafted_at').notNull(),
    settledAt: timestamp('settled_at'),
    check: jsonb('check').$type<StoredStackCheck>(),
    facts: jsonb('facts').$type<DiffFacts>().notNull(),
    workAttempts: integer('work_attempts').notNull().default(0),
    workDueAt: timestamp('work_due_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('change_stack_run_idx').on(table.runId, table.draftedAt),
    index('change_stack_task_idx').on(table.taskId, table.draftedAt),
  ],
);
