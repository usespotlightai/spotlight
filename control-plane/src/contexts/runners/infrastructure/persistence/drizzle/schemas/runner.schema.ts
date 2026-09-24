import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const runner = pgTable(
  'runner',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    labels: jsonb('labels').$type<string[]>().notNull().default([]),
    trustId: text('trust_id'),
    harnesses: jsonb('harnesses').$type<string[]>().notNull().default([]),
    advertisedModels: jsonb('advertised_models')
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    revokedAt: timestamp('revoked_at'),
    registeredAt: timestamp('registered_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at'),
    revision: integer('revision').notNull().default(0),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('runner_token_hash_idx').on(table.tokenHash),
    index('runner_workspace_idx').on(table.workspaceId),
    index('runner_trust_id_idx').on(table.trustId),
    uniqueIndex('runner_workspace_name_idx')
      .on(table.workspaceId, table.name)
      .where(sql`${table.revokedAt} is null`),
  ],
);

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
    runners: jsonb('runners').$type<string[]>().notNull().default([]),
    trusts: jsonb('trusts').$type<string[]>().notNull().default([]),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('workspace_runners_workspace_idx').on(table.workspaceId),
  ],
);
