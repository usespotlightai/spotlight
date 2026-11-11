import { MEMORY_PROPOSAL_STATES } from '@memory/domain/entities/memory-proposal.entity';
import { MEMORY_DRAFTING_FAILURES } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MEMORY_KINDS } from '@memory/domain/value-objects/memory-kind';
import { MEMORY_PROPOSERS } from '@memory/domain/value-objects/memory-proposer';
import { MEMORY_SOURCES } from '@memory/domain/value-objects/memory-source';
import { MEMORY_STATUSES } from '@memory/domain/value-objects/memory-status';
import { MEMORY_USES } from '@memory/domain/value-objects/memory-use';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const FAILURE_CODES = Object.keys(MEMORY_DRAFTING_FAILURES) as [
  keyof typeof MEMORY_DRAFTING_FAILURES,
  ...(keyof typeof MEMORY_DRAFTING_FAILURES)[],
];

export const memoryKind = pgEnum('memory_kind', MEMORY_KINDS);
export const memorySource = pgEnum('memory_source', MEMORY_SOURCES);
export const memoryStatus = pgEnum('memory_status', MEMORY_STATUSES);
export const memoryProposer = pgEnum('memory_proposer', MEMORY_PROPOSERS);
export const memoryUseVia = pgEnum('memory_use_via', MEMORY_USES);
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
    draftingRequestedAt: timestamptz('drafting_requested_at'),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    draftedIn: text('drafted_in'),
    notesRead: integer('notes_read').notNull().default(0),
    failure: memoryDraftingFailure('failure'),
    failedAt: timestamptz('failed_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'memory_draft_job_attempts_not_negative',
      sql`${table.jobAttempts} >= 0`,
    ),
    check('memory_draft_notes_read_not_negative', sql`${table.notesRead} >= 0`),
    uniqueIndex('memory_draft_task_idx').on(table.taskId),
    index('memory_draft_drafting_idx').on(table.draftingRequestedAt),
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
    proposedBy: memoryProposer('proposed_by').notNull(),
    supersedes: text('supersedes'),
    recordedAt: timestamptz('recorded_at').notNull(),
    state: memoryProposalState('state').notNull().default('proposed'),
    decidedById: text('decided_by_id'),
    decidedAt: timestamptz('decided_at'),
  },
  (table) => [
    check('memory_proposal_position_not_negative', sql`${table.position} >= 0`),
    uniqueIndex('memory_proposal_position_idx').on(
      table.draftId,
      table.position,
    ),
    check(
      'memory_proposal_decided_matches_state',
      sql`(${table.state} = 'proposed') = (${table.decidedAt} is null) and (${table.decidedById} is null) = (${table.decidedAt} is null)`,
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
    handle: integer('handle')
      .notNull()
      .generatedByDefaultAsIdentity({ name: 'memory_handle_seq' }),
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
    status: memoryStatus('status').notNull().default('active'),
    approvedById: text('approved_by_id').notNull(),
    approvedAt: timestamptz('approved_at').notNull(),
    retiredAt: timestamptz('retired_at'),
    retiredById: text('retired_by_id'),
    retireReason: text('retire_reason'),
    supersededBy: text('superseded_by'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('memory_handle_idx').on(table.handle),
    index('memory_superseded_by_idx').on(table.supersededBy),
    uniqueIndex('memory_supersedes_idx').on(table.supersedes),
    index('memory_status_idx').on(table.teamId, table.status, table.approvedAt),
    check(
      'memory_retired_at_matches_status',
      sql`(${table.status} = 'retired') = (${table.retiredAt} is not null)`,
    ),
    index('memory_body_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.body})`,
    ),
  ],
);

export const memoryUse = pgTable(
  'memory_use',
  {
    memoryId: text('memory_id')
      .notNull()
      .references(() => memory.id, { onDelete: 'cascade' }),
    runId: text('run_id').notNull(),
    via: memoryUseVia('via').notNull(),
    at: timestamptz('at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memoryId, table.runId, table.via] }),
    index('memory_use_run_idx').on(table.runId, table.at),
  ],
);
