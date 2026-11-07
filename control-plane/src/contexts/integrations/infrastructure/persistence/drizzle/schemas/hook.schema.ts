import { HOOK_FIRING_STATES } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { CauseLink } from '@integrations/domain/value-objects/causal-chain.vo';
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
    blocks: boolean('blocks').notNull(),
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
    hookId: text('hook_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    taskId: text('task_id').notNull(),
    runId: text('run_id'),
    runAttempt: integer('run_attempt'),
    stationKey: text('station_key').notNull(),
    on: text('on').notNull(),
    occurrence: text('occurrence').notNull(),
    event: jsonb('event').$type<Record<string, unknown>>().notNull(),
    matched: boolean('matched').notNull(),
    cause: jsonb('cause').$type<Record<string, unknown>>().notNull(),
    link: jsonb('link').$type<CauseLink>().notNull(),
    steps: jsonb('steps').$type<Record<string, unknown>[]>().notNull(),
    state: hookFiringState('state').notNull(),
    attempts: integer('attempts').notNull(),
    dueAt: timestamptz('due_at').notNull(),
    claimedAt: timestamptz('claimed_at'),
    failure: text('failure'),
    failed: text('failed'),
    skipped: text('skipped'),
    firedAt: timestamptz('fired_at').notNull(),
    handledAt: timestamptz('handled_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    check('hook_firing_attempts_not_negative', sql`${table.attempts} >= 0`),
    check(
      'hook_firing_skip_reason',
      sql`(${table.state} = 'skipped') = (${table.skipped} is not null)`,
    ),
    check(
      'hook_firing_whole_run',
      sql`num_nonnulls(${table.runId}, ${table.runAttempt}) in (0, 2)`,
    ),
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
    version: integer('version').notNull().default(1),
  },
  (table) => [index('hook_callback_expires_idx').on(table.expiresAt)],
);
