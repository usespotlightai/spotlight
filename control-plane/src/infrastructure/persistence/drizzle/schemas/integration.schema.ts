import { team } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

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

export const oauth2Connection = pgTable(
  'oauth2_connection',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => team.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scopes: text('scopes').notNull().default(''),
    identity: text('identity'),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);
