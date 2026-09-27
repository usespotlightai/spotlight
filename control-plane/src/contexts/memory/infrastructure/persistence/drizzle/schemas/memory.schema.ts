import { MEMORY_PROPOSAL_STATES } from '@memory/domain/entities/memory-proposal.entity';
import { MEMORY_DRAFTING_FAILURES } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MEMORY_KINDS } from '@memory/domain/value-objects/memory-kind';
import { MEMORY_SOURCES } from '@memory/domain/value-objects/memory-source';
import { MEMORY_STANDINGS } from '@memory/domain/value-objects/memory-standing';
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

const FAILURE_CODES = Object.keys(MEMORY_DRAFTING_FAILURES) as [
  keyof typeof MEMORY_DRAFTING_FAILURES,
  ...(keyof typeof MEMORY_DRAFTING_FAILURES)[],
];

export const memoryKind = pgEnum('memory_kind', MEMORY_KINDS);
export const memorySource = pgEnum('memory_source', MEMORY_SOURCES);
export const memoryStanding = pgEnum('memory_standing', MEMORY_STANDINGS);
export const memoryProposalState = pgEnum(
  'memory_proposal_state',
  MEMORY_PROPOSAL_STATES,
);
export const memoryDraftingFailure = pgEnum(
  'memory_drafting_failure',
  FAILURE_CODES,
);

export const memoryDraft = pgTable(
  'memory_draft',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    draftingRunId: text('drafting_run_id'),
    draftingAskedAt: timestamp('drafting_asked_at'),
    workAttempts: integer('work_attempts').notNull().default(0),
    workDueAt: timestamp('work_due_at'),
    draftedIn: text('drafted_in'),
    notesRead: integer('notes_read').notNull().default(0),
    failure: memoryDraftingFailure('failure'),
    failedAt: timestamp('failed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('memory_draft_task_idx').on(table.taskId),
    index('memory_draft_drafting_idx').on(table.draftingAskedAt),
  ],
);

export const memoryProposal = pgTable(
  'memory_proposal',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => memoryDraft.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: memoryKind('kind').notNull(),
    body: text('body').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id'),
    stationId: text('station_id'),
    repository: text('repository'),
    paths: jsonb('paths').$type<string[]>().notNull(),
    taskId: text('task_id').notNull(),
    runId: text('run_id').notNull(),
    steps: jsonb('steps').$type<number[]>().notNull(),
    notes: jsonb('notes').$type<number[]>().notNull(),
    source: memorySource('source').notNull(),
    supersedes: text('supersedes'),
    recordedAt: timestamp('recorded_at').notNull(),
    state: memoryProposalState('state').notNull().default('proposed'),
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at'),
  },
  (table) => [
    uniqueIndex('memory_proposal_position_idx').on(
      table.draftId,
      table.position,
    ),
    index('memory_proposal_decided_idx').on(
      table.teamId,
      table.state,
      table.decidedAt,
    ),
  ],
);

export const memory = pgTable(
  'memory',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    kind: memoryKind('kind').notNull(),
    body: text('body').notNull(),
    teamId: text('team_id').notNull(),
    lineId: text('line_id'),
    stationId: text('station_id'),
    repository: text('repository'),
    paths: jsonb('paths').$type<string[]>().notNull(),
    taskId: text('task_id'),
    runId: text('run_id'),
    steps: jsonb('steps').$type<number[]>(),
    notes: jsonb('notes').$type<number[]>(),
    source: memorySource('source').notNull(),
    supersedes: text('supersedes'),
    standing: memoryStanding('standing').notNull().default('stands'),
    approvedBy: text('approved_by').notNull(),
    approvedAt: timestamp('approved_at').notNull(),
    retiredAt: timestamp('retired_at'),
    retiredBy: text('retired_by'),
    retireReason: text('retire_reason'),
    supersededBy: text('superseded_by'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('memory_standing_idx').on(
      table.teamId,
      table.standing,
      table.approvedAt,
    ),
  ],
);
