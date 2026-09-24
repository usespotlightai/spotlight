import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const integrationCursor = pgTable(
  'integration_cursor',
  {
    teamId: text('team_id').notNull(),
    source: text('source').notNull(),
    cursor: text('cursor'),
    ranAt: timestamp('ran_at'),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);

export const hostConnection = pgTable(
  'host_connection',
  {
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    source: text('source').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scopes: text('scopes').notNull().default(''),
    handle: text('handle'),
    renewalRefusedAt: timestamp('renewal_refused_at'),
    version: integer('version').notNull().default(1),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.source] })],
);

export const oauth2SpentNonce = pgTable('oauth2_spent_nonce', {
  nonce: text('nonce').primaryKey(),
  until: timestamp('until').notNull(),
});

export const integrationDefinition = pgTable(
  'integration_definition',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    source: text('source').notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    offers: jsonb('offers').$type<string[]>().notNull(),
    version: integer('version').notNull().default(1),
    definedAt: timestamp('defined_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.source)],
);
