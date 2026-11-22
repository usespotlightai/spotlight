import { MEMORY_PROPOSAL_STATES } from '@memory/domain/entities/memory-proposal.entity';
import { MEMORY_KINDS } from '@memory/domain/value-objects/memory-kind';
import { MEMORY_SOURCES } from '@memory/domain/value-objects/memory-source';
import { MEMORY_STATUSES } from '@memory/domain/value-objects/memory-status';
import { MEMORY_USES } from '@memory/domain/value-objects/memory-use';
import {
  UPKEEP_CHANGES,
  UPKEEP_FINDINGS,
  UPKEEP_PROPOSAL_STATES,
} from '@memory/domain/value-objects/upkeep-change';
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

export const memoryKind = pgEnum('memory_kind', MEMORY_KINDS);
export const memorySource = pgEnum('memory_source', MEMORY_SOURCES);
export const memoryStatus = pgEnum('memory_status', MEMORY_STATUSES);
export const memoryUseVia = pgEnum('memory_use_via', MEMORY_USES);
export const memoryProposalState = pgEnum(
  'memory_proposal_state',
  MEMORY_PROPOSAL_STATES,
);

export const memoryProposalSet = pgTable(
  'memory_proposal_set',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [uniqueIndex('memory_proposal_set_task_idx').on(table.taskId)],
);

export const memoryProposal = pgTable(
  'memory_proposal',
  {
    id: text('id').primaryKey(),
    setId: text('set_id')
      .notNull()
      .references(() => memoryProposalSet.id, { onDelete: 'cascade' }),
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
    retires: text('retires'),
    retireReason: text('retire_reason'),
    recordedAt: timestamptz('recorded_at').notNull(),
    state: memoryProposalState('state').notNull().default('proposed'),
    decidedById: text('decided_by_id'),
    decidedAt: timestamptz('decided_at'),
  },
  (table) => [
    check('memory_proposal_position_not_negative', sql`${table.position} >= 0`),
    check(
      'memory_proposal_lapses_only_a_retirement',
      sql`${table.state}::text <> 'lapsed' or ${table.retires} is not null`,
    ),
    check(
      'memory_proposal_retires_with_reason',
      sql`(${table.retires} is null) = (${table.retireReason} is null) and (${table.retires} is null or ${table.supersedes} is null)`,
    ),
    uniqueIndex('memory_proposal_position_idx').on(
      table.setId,
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

export const memoryUpkeepChange = pgEnum('memory_upkeep_change', UPKEEP_CHANGES);
export const memoryUpkeepFinding = pgEnum(
  'memory_upkeep_finding',
  UPKEEP_FINDINGS,
);
export const memoryUpkeepProposalState = pgEnum(
  'memory_upkeep_proposal_state',
  UPKEEP_PROPOSAL_STATES,
);

export const memoryUpkeep = pgTable(
  'memory_upkeep',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    sweptAt: timestamptz('swept_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [index('memory_upkeep_team_idx').on(table.teamId, table.sweptAt)],
);

export const memoryUpkeepProposal = pgTable(
  'memory_upkeep_proposal',
  {
    upkeepId: text('upkeep_id')
      .notNull()
      .references(() => memoryUpkeep.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    position: integer('position').notNull(),
    change: memoryUpkeepChange('change').notNull(),
    finding: memoryUpkeepFinding('finding').notNull(),
    memoryIds: jsonb('memory_ids').$type<string[]>().notNull(),
    body: text('body'),
    reason: text('reason').notNull(),
    state: memoryUpkeepProposalState('state').notNull(),
    decidedById: text('decided_by_id'),
    decidedAt: timestamptz('decided_at'),
  },
  (table) => [primaryKey({ columns: [table.upkeepId, table.id] })],
);

export const memoryUpkeepSchedule = pgTable(
  'memory_upkeep_schedule',
  {
    teamId: text('team_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    dueAt: timestamptz('due_at').notNull(),
    addedSince: integer('added_since').notNull().default(0),
    jobAttempts: integer('job_attempts').notNull().default(0),
    jobDueAt: timestamptz('job_due_at'),
    waitingSince: timestamptz('waiting_since'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check(
      'memory_upkeep_schedule_counts_not_negative',
      sql`${table.addedSince} >= 0 and ${table.jobAttempts} >= 0`,
    ),
    index('memory_upkeep_schedule_due_idx').on(table.dueAt),
  ],
);
