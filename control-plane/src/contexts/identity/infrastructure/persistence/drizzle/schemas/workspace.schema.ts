import { WORKSPACE_ROLES } from '@identity/domain/value-objects/workspace-role.vo';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
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

export const teamInvite = pgTable(
  'team_invite',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
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
    uniqueIndex('team_invite_team_email_idx')
      .on(table.teamId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index('team_invite_team_idx').on(table.teamId, table.email),
    index('team_invite_workspace_idx').on(table.workspaceId),
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
    version: integer('version').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('workspace_token_workspace_name_idx').on(
      table.workspaceId,
      table.name,
    ),
  ],
);
