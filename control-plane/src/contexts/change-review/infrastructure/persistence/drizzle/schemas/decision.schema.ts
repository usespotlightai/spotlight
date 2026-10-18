import {
  DECISION_KINDS,
  type DecisionKind,
} from '@change-review/domain/entities/decision.entity';
import {
  DECISION_STATUSES,
  type DecisionStatusValue,
} from '@change-review/domain/value-objects/decision-status.vo';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const decisionKind = pgEnum('decision_kind', DECISION_KINDS);
export const decisionStatus = pgEnum('decision_status', DECISION_STATUSES);

export const decisionSet = pgTable(
  'decision_set',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    sourceRunId: text('source_run_id'),
    generationRunId: text('generation_run_id'),
    generationRequestedAt: timestamp('generation_requested_at'),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamp('job_due_at'),
    status: decisionStatus('status')
      .$type<DecisionStatusValue>()
      .notNull()
      .default('proposed'),
    mergedRepository: text('merged_repository'),
    mergedCommit: text('merged_commit'),
    mergedAt: timestamp('merged_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('decision_set_task_idx').on(table.taskId),
    index('decision_set_generation_idx').on(table.generationRequestedAt),
    index('decision_set_merged_idx').on(
      table.workspaceId,
      table.mergedRepository,
      table.mergedAt,
    ),
  ],
);

export const decision = pgTable(
  'decision',
  {
    id: text('id').primaryKey(),
    setId: text('set_id')
      .notNull()
      .references(() => decisionSet.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: decisionKind('kind').$type<DecisionKind>().notNull(),
    title: text('title').notNull(),
    why: text('why').notNull(),
    alternatives: jsonb('alternatives').$type<string[]>().notNull(),
    paths: jsonb('paths').$type<string[]>().notNull(),
    journalSteps: jsonb('journal_steps').$type<number[]>().notNull(),
  },
  (table) => [
    uniqueIndex('decision_position_idx').on(table.setId, table.position),
    index('decision_paths_idx').using('gin', table.paths),
  ],
);

export const decisionDispute = pgTable(
  'decision_dispute',
  {
    id: text('id').primaryKey(),
    decisionId: text('decision_id')
      .notNull()
      .references(() => decision.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    byUserId: text('by_user_id').notNull(),
    reason: text('reason').notNull(),
    at: timestamp('at').notNull(),
  },
  (table) => [index('decision_dispute_decision_idx').on(table.decisionId)],
);
