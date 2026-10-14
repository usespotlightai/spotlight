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

export const workspaceTokenScope = pgEnum(
  'workspace_token_scope',
  TOKEN_SCOPES,
);

export const workspace = pgTable('workspace', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
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
      'workspace_invite_closed_once',
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
    mintedThrough: text('minted_through'),
    mintedUnder: integer('minted_under'),
    mintedForRun: text('minted_for_run'),
    mintedForAttempt: integer('minted_for_attempt'),
    version: integer('version').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('workspace_token_workspace_name_idx')
      .on(table.workspaceId, table.name)
      .where(
        sql`${table.mintedThrough} is null and ${table.mintedForRun} is null`,
      ),
    index('workspace_token_minted_for_run_idx').on(table.mintedForRun),
    index('workspace_token_minted_through_idx').on(table.mintedThrough),
    check(
      'workspace_token_minted_under',
      sql`(${table.mintedThrough} is null) = (${table.mintedUnder} is null)`,
    ),
    check(
      'workspace_token_minted_for_attempt',
      sql`(${table.mintedForRun} is null) = (${table.mintedForAttempt} is null)`,
    ),
    check(
      'workspace_token_minted_once',
      sql`${table.mintedThrough} is null or ${table.mintedForRun} is null`,
    ),
    index('workspace_token_minted_expiry_idx')
      .on(table.expiresAt)
      .where(
        sql`${table.mintedThrough} is not null or ${table.mintedForRun} is not null`,
      ),
  ],
);

export const workspaceTokenTrust = pgTable(
  'workspace_token_trust',
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
    definedBy: text('defined_by').notNull(),
    version: integer('version').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('workspace_token_trust_workspace_key_idx').on(
      table.workspaceId,
      table.key,
    ),
  ],
);
