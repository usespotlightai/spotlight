import { CHECK_PHASES } from '@change-review/domain/value-objects/stack-check.vo';
import type {
  StoredCheckEntry,
  StoredCheckOutcome,
} from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.rows';
import {
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
    workspaceId: text('workspace_id').notNull(),
    command: text('command').notNull(),
    setup: text('setup'),
    phase: checkPhase('phase').notNull(),
    entries: jsonb('entries').$type<StoredCheckEntry[]>().notNull().default([]),
    rounds: integer('rounds').notNull().default(0),
    outcome: jsonb('outcome').$type<StoredCheckOutcome>(),
    claimedBy: text('claimed_by'),
    attempts: integer('attempts').notNull().default(0),
    leaseExpiresAt: timestamp('lease_expires_at'),
    waitingSince: timestamp('waiting_since').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('stack_check_run_idx').on(table.runId),
    index('stack_check_waiting_idx').on(table.workspaceId, table.phase),
  ],
);
