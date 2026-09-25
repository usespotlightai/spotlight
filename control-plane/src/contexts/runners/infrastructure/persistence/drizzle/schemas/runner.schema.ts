import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const runnerTrust = pgTable(
  'runner_trust',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    key: text('key').notNull(),
    issuer: text('issuer').notNull(),
    subject: text('subject').notNull(),
    audience: text('audience').notNull(),
    labels: jsonb('labels').$type<string[]>().notNull().default([]),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('runner_trust_workspace_key_idx').on(
      table.workspaceId,
      table.key,
    ),
  ],
);

export const workspaceRunners = pgTable(
  'workspace_runners',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    trusts: jsonb('trusts').$type<string[]>().notNull().default([]),
    pools: jsonb('pools').$type<string[]>().notNull().default([]),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('workspace_runners_workspace_idx').on(table.workspaceId),
  ],
);

export const runnerPool = pgTable(
  'runner_pool',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    key: text('key').notNull(),
    labels: jsonb('labels').$type<string[]>().notNull().default([]),
    maxRuns: integer('max_runs'),
    tokenHash: text('token_hash'),
    tokenVersion: integer('token_version'),
    provisionUrl: text('provision_url'),
    provisionSecret: text('provision_secret'),
    provisionSecretVersion: integer('provision_secret_version'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('runner_pool_workspace_key_idx').on(
      table.workspaceId,
      table.key,
    ),
    uniqueIndex('runner_pool_token_hash_idx').on(table.tokenHash),
    check(
      'runner_pool_one_mode',
      sql`(${table.tokenHash} is null) <> (${table.provisionUrl} is null) and (${table.provisionUrl} is null) = (${table.provisionSecret} is null)`,
    ),
  ],
);

export const runner = pgTable(
  'runner',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    poolId: text('pool_id'),
    trustId: text('trust_id'),
    hostId: text('host_id'),
    labels: jsonb('labels').$type<string[]>().notNull().default([]),
    tokenHash: text('token_hash').notNull(),
    harnesses: jsonb('harnesses').$type<string[]>().notNull().default([]),
    advertisedModels: jsonb('advertised_models')
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    harnessVersions: jsonb('harness_versions')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    workKind: text('work_kind'),
    workId: text('work_id'),
    claimBy: timestamp('claim_by').notNull(),
    startedAt: timestamp('started_at').notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    endedAt: timestamp('ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('runner_token_hash_idx').on(table.tokenHash),
    index('runner_pool_standing_idx')
      .on(table.poolId)
      .where(sql`${table.endedAt} is null`),
    index('runner_work_idx')
      .on(table.workKind, table.workId)
      .where(sql`${table.endedAt} is null`),
    index('runner_workspace_standing_idx')
      .on(table.workspaceId)
      .where(sql`${table.endedAt} is null`),
    check(
      'runner_whole_work',
      sql`(${table.workKind} is null) = (${table.workId} is null)`,
    ),
    check(
      'runner_one_admission',
      sql`(${table.poolId} is null) <> (${table.trustId} is null)`,
    ),
  ],
);

export const runnerHost = pgTable(
  'runner_host',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    poolId: text('pool_id'),
    trustId: text('trust_id'),
    name: text('name').notNull(),
    release: text('release').notNull(),
    executor: text('executor').notNull(),
    capacity: integer('capacity').notNull(),
    running: jsonb('running').$type<string[]>().notNull().default([]),
    harnesses: jsonb('harnesses')
      .$type<{ id: string; models: string[]; version?: string }[]>()
      .notNull()
      .default([]),
    firstSeenAt: timestamp('first_seen_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('runner_host_workspace_idx').on(table.workspaceId),
    index('runner_host_pool_idx').on(table.poolId),
    index('runner_host_trust_idx').on(table.trustId),
    index('runner_host_last_seen_idx').on(table.lastSeenAt),
    check(
      'runner_host_one_admission',
      sql`(${table.poolId} is null) <> (${table.trustId} is null)`,
    ),
  ],
);
