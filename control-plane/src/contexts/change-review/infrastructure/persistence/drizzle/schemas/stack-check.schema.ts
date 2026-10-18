import { STACK_CHECK_STATUSES } from '@change-review/domain/value-objects/stack-check.vo';
import type {
  StoredCheckEntry,
  StoredCheckOutcome,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const stackCheckStatus = pgEnum(
  'stack_check_status',
  STACK_CHECK_STATUSES,
);

export const stackCheck = pgTable(
  'stack_check',
  {
    stackId: text('stack_id').notNull(),
    recheck: boolean('recheck').notNull().default(false),
    runId: text('run_id').notNull(),
    taskId: text('task_id'),
    replay: boolean('replay').notNull().default(false),
    workspaceId: text('workspace_id').notNull(),
    command: text('command').notNull(),
    setup: text('setup'),
    placement: jsonb('placement')
      .$type<readonly (readonly string[])[]>()
      .notNull()
      .default([]),
    placementImage: text('placement_image'),
    status: stackCheckStatus('status').notNull(),
    entries: jsonb('entries').$type<StoredCheckEntry[]>().notNull().default([]),
    redraftCount: integer('redraft_count').notNull().default(0),
    outcome: jsonb('outcome').$type<StoredCheckOutcome>(),
    claimedBy: text('claimed_by'),
    attempts: integer('attempts').notNull().default(0),
    leaseExpiresAt: timestamp('lease_expires_at'),
    claimedAt: timestamp('claimed_at'),
    waitingSince: timestamp('waiting_since').notNull(),
    reservedFor: text('reserved_for'),
    reservedPool: text('reserved_pool'),
    reservedUntil: timestamp('reserved_until'),
    provisionAttempts: integer('provision_attempts').notNull().default(0),
    nextProvisionAttemptAt: timestamp('next_provision_attempt_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.stackId, table.recheck] }),
    index('stack_check_run_idx').on(table.runId),
    index('stack_check_task_idx').on(table.taskId),
    index('stack_check_waiting_idx').on(table.workspaceId, table.status),
    index('stack_check_reserved_idx').on(table.reservedFor),
    index('stack_check_wait_expiry_idx').on(table.status, table.waitingSince),
  ],
);
