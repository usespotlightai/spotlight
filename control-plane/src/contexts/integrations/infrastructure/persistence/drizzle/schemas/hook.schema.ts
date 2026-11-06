import { HOOK_FIRING_STATES } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import type { CauseLink } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const hookDefinition = pgTable(
  'hook_definition',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    key: text('key').notNull(),
    on: text('on').notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    tools: jsonb('tools').$type<string[]>().notNull(),
    signingSecret: text('signing_secret'),
    signingSecretVersion: integer('signing_secret_version'),
    version: integer('version').notNull().default(1),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique().on(table.teamId, table.key),
    index('hook_definition_on_idx').on(table.teamId, table.on),
  ],
);

export const hookFiringState = pgEnum('hook_firing_state', HOOK_FIRING_STATES);

export const hookFiring = pgTable(
  'hook_firing',
  {
    id: text('id').primaryKey(),
    hookId: text('hook_id')
      .notNull()
      .references(() => hookDefinition.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    taskId: text('task_id').notNull(),
    runId: text('run_id'),
    stationKey: text('station_key').notNull(),
    on: text('on').notNull(),
    occurrence: text('occurrence').notNull(),
    event: jsonb('event').$type<Record<string, unknown>>().notNull(),
    matched: boolean('matched').notNull().default(true),
    cause: jsonb('cause').$type<Record<string, unknown>>().notNull(),
    link: jsonb('link').$type<CauseLink>().notNull(),
    steps: jsonb('steps')
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default([]),
    state: hookFiringState('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamptz('due_at').defaultNow().notNull(),
    claimedAt: timestamptz('claimed_at'),
    failure: text('failure'),
    failed: text('failed'),
    firedAt: timestamptz('fired_at').defaultNow().notNull(),
    handledAt: timestamptz('handled_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    check('hook_firing_attempts_not_negative', sql`${table.attempts} >= 0`),
    unique().on(table.hookId, table.occurrence),
    index('hook_firing_state_idx').on(table.state, table.dueAt),
    index('hook_firing_repeats_idx').on(
      table.hookId,
      table.taskId,
      table.firedAt,
    ),
  ],
);

export const hookCallback = pgTable(
  'hook_callback',
  {
    tokenHash: text('token_hash').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    hook: text('hook').notNull(),
    firingId: text('firing_id'),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (table) => [index('hook_callback_expires_idx').on(table.expiresAt)],
);
