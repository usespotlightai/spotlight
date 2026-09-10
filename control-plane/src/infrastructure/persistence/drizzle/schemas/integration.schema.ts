import { team } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Where a team's poll of one host last got to: the cursor it read, and when it
 * last ran. Kept so a poll asks the host only for what is new, and only when it
 * is due.
 */
export const integrationCursor = pgTable(
  'integration_cursor',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    cursor: text('cursor'),
    ranAt: timestamp('ran_at'),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);

/**
 * A team's OAuth2 link to one host: the tokens sealed the same way a secret is,
 * when the access token expires, and who the host says the team is. Written by
 * the connect flow, read by an outbound call that authenticates as the team.
 */
export const oauth2Connection = pgTable(
  'oauth2_connection',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    /** Sealed with the deployment's key, as team secrets are. */
    accessToken: text('access_token').notNull(),
    /** Sealed too; absent where the host issues none. */
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scopes: text('scopes').notNull().default(''),
    /** What the host called the team when it linked, for a person to recognise. */
    identity: text('identity'),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);
