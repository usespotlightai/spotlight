import { timestamptz } from '@platform/persistence/drizzle/columns';
import { SANDBOX_STATES } from '@runners/domain/aggregates/sandbox.aggregate';
import { RUNNER_WORK_KINDS } from '@runners/domain/value-objects/runner-work.vo';
import { TOKEN_HOLDER_KINDS } from '@runners/domain/value-objects/token-holder.vo';
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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface HostImageRecord {
  readonly image: string;
  readonly digest?: string;
  readonly isDefault: boolean;
  readonly release?: string;
  readonly harnesses: readonly {
    readonly id: string;
    readonly models: readonly string[];
    readonly version?: string;
  }[];
  readonly unavailableReason?: string;
}

export const runnerWorkKind = pgEnum('runner_work_kind', RUNNER_WORK_KINDS);
export const sandboxState = pgEnum('sandbox_state', SANDBOX_STATES);
export const tokenHolderKind = pgEnum('token_holder_kind', TOKEN_HOLDER_KINDS);

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
    createdAt: timestamptz('created_at').defaultNow().notNull(),
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
    provisionEgress: text('provision_egress'),
    provisionEgressTraffic: text('provision_egress_traffic'),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
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
    check(
      'runner_pool_egress_pushes',
      sql`${table.provisionEgress} is null or ${table.provisionUrl} is not null`,
    ),
  ],
);

export const egress = pgTable(
  'egress',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    key: text('key').notNull(),
    url: text('url').notNull(),
    tokenHash: text('token_hash').notNull(),
    tokenVersion: integer('token_version'),
    version: integer('version').notNull().default(0),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('egress_workspace_key_idx').on(table.workspaceId, table.key),
    uniqueIndex('egress_token_hash_idx').on(table.tokenHash),
  ],
);

export const usedToken = pgTable(
  'used_token',
  {
    holderKind: tokenHolderKind('holder_kind').notNull(),
    tokenHash: text('token_hash').notNull(),
    holderId: text('holder_id').notNull(),
    usedAt: timestamptz('used_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.holderKind, table.tokenHash] })],
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
    egressTokenHash: text('egress_token_hash'),
    proxyCredentialHash: text('proxy_credential_hash'),
    harnesses: jsonb('harnesses').$type<string[]>().notNull().default([]),
    supportedModels: jsonb('supported_models')
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    harnessVersions: jsonb('harness_versions')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    image: text('image'),
    isDefault: boolean('is_default').notNull().default(false),
    workKind: runnerWorkKind('work_kind'),
    workId: text('work_id'),
    claimBy: timestamptz('claim_by').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    lastHeartbeatAt: timestamptz('last_heartbeat_at'),
    endedAt: timestamptz('ended_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('runner_token_hash_idx').on(table.tokenHash),
    uniqueIndex('runner_egress_token_hash_idx').on(table.egressTokenHash),
    uniqueIndex('runner_proxy_credential_hash_idx').on(
      table.proxyCredentialHash,
    ),
    index('runner_pool_active_idx')
      .on(table.poolId)
      .where(sql`${table.endedAt} is null`),
    index('runner_work_idx')
      .on(table.workKind, table.workId)
      .where(sql`${table.endedAt} is null`),
    index('runner_workspace_active_idx')
      .on(table.workspaceId)
      .where(sql`${table.endedAt} is null`),
    check(
      'runner_whole_work',
      sql`(${table.workKind} is null) = (${table.workId} is null)`,
    ),
    check(
      'runner_one_credential_source',
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
    containerRuntime: text('container_runtime').notNull(),
    capacity: integer('capacity').notNull(),
    running: jsonb('running').$type<string[]>().notNull().default([]),
    images: jsonb('images').$type<HostImageRecord[]>().notNull().default([]),
    sandboxes: jsonb('sandboxes').$type<string[]>().notNull().default([]),
    stopping: boolean('stopping').notNull().default(false),
    bootId: text('boot_id').notNull(),
    firstHeartbeatAt: timestamptz('first_heartbeat_at').notNull(),
    onlineSince: timestamptz('online_since').notNull(),
    lastHeartbeatAt: timestamptz('last_heartbeat_at').notNull(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('runner_host_capacity_positive', sql`${table.capacity} > 0`),
    index('runner_host_workspace_idx').on(table.workspaceId),
    index('runner_host_pool_idx').on(table.poolId),
    index('runner_host_trust_idx').on(table.trustId),
    index('runner_host_last_heartbeat_idx').on(table.lastHeartbeatAt),
    check(
      'runner_host_one_credential_source',
      sql`(${table.poolId} is null) <> (${table.trustId} is null)`,
    ),
  ],
);

export interface SandboxLeaseRecord {
  readonly kind: string;
  readonly holder: string;
  readonly renewedAt: string;
}

export const sandbox = pgTable(
  'sandbox',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    key: text('key'),
    hostId: text('host_id'),
    poolId: text('pool_id'),
    trustId: text('trust_id'),
    tokenHash: text('token_hash'),
    state: sandboxState('state').notNull(),
    leases: jsonb('leases').$type<SandboxLeaseRecord[]>().notNull().default([]),
    idleSince: timestamptz('idle_since'),
    startedAt: timestamptz('started_at').notNull(),
    goneAt: timestamptz('gone_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('sandbox_open_key_idx')
      .on(table.workspaceId, table.key)
      .where(sql`${table.key} is not null and ${table.state} = 'open'`),
    index('sandbox_host_live_idx')
      .on(table.hostId)
      .where(sql`${table.state} <> 'gone'`),
    index('sandbox_idle_idx')
      .on(table.idleSince)
      .where(sql`${table.state} = 'open'`),
    index('sandbox_pool_idle_idx')
      .on(table.poolId)
      .where(sql`${table.state} <> 'gone' and ${table.idleSince} is not null`),
    index('sandbox_gone_idx').on(table.goneAt),
    uniqueIndex('sandbox_token_hash_idx').on(table.tokenHash),
    index('sandbox_requested_idx')
      .on(table.workspaceId, table.startedAt)
      .where(sql`${table.hostId} is null and ${table.state} = 'open'`),
    check(
      'sandbox_host_has_token',
      sql`(${table.hostId} is null) = (${table.tokenHash} is null)`,
    ),
    check(
      'sandbox_host_has_one_credential_source',
      sql`(${table.hostId} is null) = (${table.poolId} is null and ${table.trustId} is null) and (${table.poolId} is null or ${table.trustId} is null)`,
    ),
    check(
      'sandbox_gone_at_matches_state',
      sql`(${table.state} = 'gone') = (${table.goneAt} is not null)`,
    ),
  ],
);
