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

/**
 * Where each workspace reaches each host. Keyed by what the host calls it,
 * because that is all a delivery carries: two workspaces on one identifier
 * would leave nowhere to send it.
 */
export const workspaceConnection = pgTable(
  'workspace_connection',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    /** The name the source is addressed by, as in github. */
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.externalId] }),
    // One host at a time per workspace, so connecting again replaces.
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
    /**
     * What it is called where a person writes it down: the directory its
     * configuration sits in, and the door its hosts knock at.
     */
    key: text('key').notNull(),
    /**
     * The repository Spotlight reads this team's configuration from. Where
     * none is named, whichever connected repository holds a `.spotlight`
     * directory is read instead, and this is what pins that choice.
     */
    configRepository: text('config_repository'),
    /**
     * Where this team's configuration is on its way to, with a pull request
     * carrying it open there. Reading stays with `config_repository` until
     * the move lands.
     */
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
    // One key per workspace: it is half of a team's address.
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

/**
 * What a team's configuration may name but never hold. The value is sealed
 * with the deployment's key before it reaches this table, so a copy of the
 * database is a table of names and nothing else.
 *
 * Held by the team rather than the workspace because the hosts that verify
 * with them are the team's: two teams may reach the same host and sign with
 * different secrets, or reach different ones entirely.
 */
export const teamSecret = pgTable(
  'team_secret',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Sealed. Nothing reads this but the cipher that wrote it. */
    sealed: text('sealed').notNull(),
    setAt: timestamp('set_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.name] })],
);

/**
 * A team's configuration as it last read, and everything wrong with it.
 * Kept rather than fetched: a delivery is never waiting on GitHub, and a host
 * is answered whether or not the repository can be reached at all.
 */
export const teamConfig = pgTable('team_config', {
  teamId: text('team_id')
    .primaryKey()
    .references(() => team.id, { onDelete: 'cascade' }),
  repository: text('repository').notNull(),
  /** The commit it was read at, which is what makes it worth re-reading. */
  sha: text('sha').notNull(),
  files: jsonb('files').$type<{ path: string; text: string }[]>().notNull(),
  problems: jsonb('problems')
    .$type<{ path: string; at: string; reason: string }[]>()
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
