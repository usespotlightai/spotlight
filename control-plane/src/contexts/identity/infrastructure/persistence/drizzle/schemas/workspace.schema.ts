import { JOB_FUNCTIONS } from '@identity/domain/value-objects/job-function.vo';
import { WORKSPACE_ROLES } from '@identity/domain/value-objects/workspace-role.vo';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const workspaceRole = pgEnum('workspace_role', WORKSPACE_ROLES);

export const jobFunction = pgEnum('job_function', JOB_FUNCTIONS);

export const workspaceTokenScope = pgEnum(
  'workspace_token_scope',
  TOKEN_SCOPES,
);

export const workspace = pgTable('workspace', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  outboundHosts: text('outbound_hosts').array().notNull().default([]),
  version: integer('version').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const workspaceMember = pgTable(
  'workspace_member',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_member_user_idx').on(table.userId),
  ],
);

export const signupSurvey = pgTable('signup_survey', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  respondentId: text('respondent_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  jobFunction: jobFunction('job_function').notNull(),
  referralSource: text('referral_source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const team = pgTable(
  'team',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    version: integer('version').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('team_workspace_idx').on(table.workspaceId),
    uniqueIndex('team_workspace_key_idx').on(table.workspaceId, table.key),
  ],
);

export const teamMember = pgTable(
  'team_member',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    index('team_member_user_idx').on(table.userId),
  ],
);

export const workspaceInvite = pgTable(
  'workspace_invite',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: workspaceRole('role').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    invitedAt: timestamp('invited_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    acceptedBy: text('accepted_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    revokedAt: timestamp('revoked_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    uniqueIndex('workspace_invite_workspace_email_idx')
      .on(table.workspaceId, sql`lower(${table.email})`)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index('workspace_invite_workspace_idx').on(
      table.workspaceId,
      table.invitedAt,
    ),
    check('workspace_invite_role', sql`${table.role} <> 'owner'`),
    check(
      'workspace_invite_accepted_by',
      sql`${table.acceptedBy} is null or ${table.acceptedAt} is not null`,
    ),
    check(
      'workspace_invite_ended_once',
      sql`not (${table.acceptedAt} is not null and ${table.revokedAt} is not null)`,
    ),
  ],
);

export const workspaceInviteTeam = pgTable(
  'workspace_invite_team',
  {
    inviteId: text('invite_id')
      .notNull()
      .references(() => workspaceInvite.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.inviteId, table.teamId] }),
    index('workspace_invite_team_team_idx').on(table.teamId),
  ],
);

export const workspaceToken = pgTable(
  'workspace_token',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    scopes: workspaceTokenScope('scopes').array().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    issuedBy: text('issued_by').notNull(),
    issuedAt: timestamp('issued_at').notNull(),
    expiresAt: timestamp('expires_at'),
    issuedByTrustId: text('issued_by_trust_id'),
    trustVersion: integer('trust_version'),
    runId: text('run_id'),
    runAttempt: integer('run_attempt'),
    version: integer('version').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('workspace_token_workspace_name_idx')
      .on(table.workspaceId, table.name)
      .where(sql`${table.issuedByTrustId} is null and ${table.runId} is null`),
    index('workspace_token_run_id_idx').on(table.runId),
    index('workspace_token_issued_by_trust_id_idx').on(table.issuedByTrustId),
    check(
      'workspace_token_trust_version',
      sql`(${table.issuedByTrustId} is null) = (${table.trustVersion} is null)`,
    ),
    check(
      'workspace_token_run_attempt',
      sql`(${table.runId} is null) = (${table.runAttempt} is null)`,
    ),
    check(
      'workspace_token_issued_once',
      sql`${table.issuedByTrustId} is null or ${table.runId} is null`,
    ),
    index('workspace_token_issued_expiry_idx')
      .on(table.expiresAt)
      .where(
        sql`${table.issuedByTrustId} is not null or ${table.runId} is not null`,
      ),
  ],
);

export const oidcTrust = pgTable(
  'oidc_trust',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'restrict' }),
    key: text('key').notNull(),
    issuer: text('issuer').notNull(),
    audience: text('audience').notNull(),
    subject: text('subject').notNull(),
    claims: jsonb('claims')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    scopes: workspaceTokenScope('scopes').array().notNull(),
    lifetimeMinutes: integer('lifetime_minutes').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    version: integer('version').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('oidc_trust_workspace_key_idx').on(
      table.workspaceId,
      table.key,
    ),
  ],
);

export const oidcTrustUsage = pgTable('oidc_trust_usage', {
  trustId: text('trust_id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  lastIssuedAt: timestamp('last_issued_at').notNull(),
});
