import { CHECK_PHASES } from '@change-review/domain/value-objects/stack-check.vo';
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
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const checkPhase = pgEnum('check_phase', CHECK_PHASES);

export const stackCheck = pgTable(
  'stack_check',
  {
    stackId: text('stack_id').primaryKey(),
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
    phase: checkPhase('phase').notNull(),
    entries: jsonb('entries').$type<StoredCheckEntry[]>().notNull().default([]),
    rounds: integer('rounds').notNull().default(0),
    outcome: jsonb('outcome').$type<StoredCheckOutcome>(),
    claimedBy: text('claimed_by'),
    attempts: integer('attempts').notNull().default(0),
    leaseExpiresAt: timestamp('lease_expires_at'),
    claimedAt: timestamp('claimed_at'),
    waitingSince: timestamp('waiting_since').notNull(),
    reservedFor: text('reserved_for'),
    reservedPool: text('reserved_pool'),
    reservedUntil: timestamp('reserved_until'),
    provisionFailures: integer('provision_failures').notNull().default(0),
    nextProvisionAt: timestamp('next_provision_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('stack_check_run_idx').on(table.runId),
    index('stack_check_task_idx').on(table.taskId),
    index('stack_check_waiting_idx').on(table.workspaceId, table.phase),
    index('stack_check_reserved_idx').on(table.reservedFor),
    index('stack_check_overdue_idx').on(table.phase, table.waitingSince),
  ],
);
