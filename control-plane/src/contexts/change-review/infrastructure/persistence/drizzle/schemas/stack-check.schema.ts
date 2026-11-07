import { STACK_CHECK_STATUSES } from '@change-review/domain/value-objects/stack-check.vo';
import type {
  StoredCheckEntry,
  StoredCheckOutcome,
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
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export const stackCheckStatus = pgEnum(
  'stack_check_status',
  STACK_CHECK_STATUSES,
);

export const stackCheck = pgTable(
  'stack_check',
  {
    stackId: text('stack_id').notNull(),
    recheck: boolean('recheck').notNull(),
    runId: text('run_id').notNull(),
    taskId: text('task_id'),
    teamId: text('team_id'),
    trial: boolean('trial').notNull(),
    workspaceId: text('workspace_id').notNull(),
    command: text('command').notNull(),
    setup: text('setup'),
    placement: jsonb('placement')
      .$type<readonly (readonly string[])[]>()
      .notNull(),
    placementImage: text('placement_image'),
    status: stackCheckStatus('status').notNull(),
    entries: jsonb('entries').$type<StoredCheckEntry[]>().notNull(),
    redraftCount: integer('redraft_count').notNull(),
    outcome: jsonb('outcome').$type<StoredCheckOutcome>(),
    claimedBy: text('claimed_by'),
    attempts: integer('attempts').notNull(),
    leaseExpiresAt: timestamptz('lease_expires_at'),
    claimedAt: timestamptz('claimed_at'),
    waitingSince: timestamptz('waiting_since').notNull(),
    reservedFor: text('reserved_for'),
    reservedPool: text('reserved_pool'),
    reservedUntil: timestamptz('reserved_until'),
    provisionAttempts: integer('provision_attempts').notNull(),
    nextProvisionAttemptAt: timestamptz('next_provision_attempt_at'),
    version: integer('version').notNull(),
  },
  (table) => [
    check(
      'stack_check_redraft_count_not_negative',
      sql`${table.redraftCount} >= 0`,
    ),
    check('stack_check_attempts_not_negative', sql`${table.attempts} >= 0`),
    check(
      'stack_check_provision_attempts_not_negative',
      sql`${table.provisionAttempts} >= 0`,
    ),
    primaryKey({ columns: [table.stackId, table.recheck] }),
    index('stack_check_run_idx').on(table.runId),
    index('stack_check_task_idx').on(table.taskId),
    index('stack_check_team_idx').on(table.teamId),
    index('stack_check_waiting_idx').on(table.workspaceId, table.status),
    index('stack_check_reserved_idx').on(table.reservedFor),
    index('stack_check_wait_expiry_idx').on(table.status, table.waitingSince),
  ],
);
