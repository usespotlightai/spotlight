import { TEAM_ROLES } from '@domain/value-objects/team-role.vo';
import { WORKSPACE_ROLES } from '@domain/value-objects/workspace-role.vo';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import {
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
export const teamRole = pgEnum('team_role', TEAM_ROLES);

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

export const workspaceConnection = pgTable(
  'workspace_connection',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.externalId] }),
    uniqueIndex('workspace_connection_workspace_source_idx').on(
      table.workspaceId,
      table.source,
    ),
  ],
);

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
    configRepository: text('config_repository'),
    configMovingTo: text('config_moving_to'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
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
    role: teamRole('role').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    index('team_member_user_idx').on(table.userId),
  ],
);

export const teamVaultKey = pgTable('team_vault_key', {
  teamId: text('team_id')
    .primaryKey()
    .references(() => team.id, { onDelete: 'cascade' }),
  sealedKey: text('sealed_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamConfig = pgTable('team_config', {
  teamId: text('team_id')
    .primaryKey()
    .references(() => team.id, { onDelete: 'cascade' }),
  repository: text('repository').notNull(),
  sha: text('sha').notNull(),
  files: jsonb('files').$type<{ path: string; text: string }[]>().notNull(),
  problems: jsonb('problems')
    .$type<
      {
        path: string;
        at: string;
        reason: string;
        severity: 'error' | 'warning';
      }[]
    >()
    .notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
});

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
    role: teamRole('role').notNull(),
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
  },
  (table) => [
    uniqueIndex('team_invite_team_email_idx').on(table.teamId, table.email),
    index('team_invite_workspace_idx').on(table.workspaceId),
  ],
);
