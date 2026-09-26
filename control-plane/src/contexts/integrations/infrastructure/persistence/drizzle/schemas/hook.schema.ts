import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    definedAt: timestamp('defined_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique().on(table.teamId, table.key),
    index('hook_definition_on_idx').on(table.teamId, table.on),
  ],
);

export const HOOK_FIRING_STATES = [
  'pending',
  'working',
  'done',
  'failed',
] as const;

export type HookFiringState = (typeof HOOK_FIRING_STATES)[number];

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
    on: text('on').notNull(),
    occurrence: text('occurrence').notNull(),
    event: jsonb('event').$type<Record<string, unknown>>().notNull(),
    matched: boolean('matched').notNull().default(true),
    steps: jsonb('steps')
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default([]),
    state: text('state').$type<HookFiringState>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamp('due_at').defaultNow().notNull(),
    claimedAt: timestamp('claimed_at'),
    failed: text('failed'),
    firedAt: timestamp('fired_at').defaultNow().notNull(),
    handledAt: timestamp('handled_at'),
  },
  (table) => [
    unique().on(table.hookId, table.occurrence),
    index('hook_firing_state_idx').on(table.state, table.dueAt),
  ],
);

export const hookCallback = pgTable(
  'hook_callback',
  {
    tokenHash: text('token_hash').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    hook: text('hook').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [index('hook_callback_expires_idx').on(table.expiresAt)],
);
