import {
  index,
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
    integration: text('integration').notNull(),
    cursor: text('cursor'),
    ranAt: timestamp('ran_at'),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.integration] })],
);

export const integrationConnection = pgTable(
  'integration_connection',
  {
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    integration: text('integration').notNull(),
    owner: text('owner').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scopes: text('scopes').notNull().default(''),
    linkedAccount: text('linked_account'),
    refreshFailedAt: timestamp('refresh_failed_at'),
    refreshClaimedUntil: timestamp('refresh_claimed_until'),
    version: integer('version').notNull().default(1),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.integration, table.owner] }),
    index('integration_connection_owner_idx').on(table.teamId, table.owner),
  ],
);

export const inferredOutputSchema = pgTable(
  'inferred_output_schema',
  {
    teamId: text('team_id').notNull(),
    tool: text('tool').notNull(),
    integration: text('integration').notNull(),
    shape: jsonb('shape').notNull(),
    calls: integer('calls').notNull(),
    inferredAt: timestamp('inferred_at').notNull(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.tool] }),
    index('inferred_output_schema_integration_idx').on(
      table.teamId,
      table.integration,
    ),
  ],
);

export const personToolPolicy = pgTable(
  'person_tool_policy',
  {
    teamId: text('team_id').notNull(),
    personId: text('person_id').notNull(),
    integration: text('integration').notNull(),
    rules: jsonb('rules').$type<Record<string, string>>().notNull(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.personId, table.integration] }),
  ],
);

export const oauth2ClientRegistration = pgTable(
  'oauth2_client_registration',
  {
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    integration: text('integration').notNull(),
    registrationEndpoint: text('registration_endpoint').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    issuer: text('issuer'),
    authorizeEndpoint: text('authorize_endpoint'),
    tokenEndpoint: text('token_endpoint'),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret'),
    secretExpiresAt: timestamp('secret_expires_at'),
    version: integer('version').notNull().default(1),
    registeredAt: timestamp('registered_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.integration] })],
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
    integration: text('integration').notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    tools: jsonb('tools').$type<string[]>().notNull(),
    specFingerprint: text('spec_fingerprint'),
    specHash: text('spec_hash'),
    specReadAt: timestamp('spec_read_at'),
    specProblem: text('spec_problem'),
    specSkipped: jsonb('spec_skipped').$type<string[]>(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.integration)],
);

export const specDocument = pgTable('spec_document', {
  hash: text('hash').primaryKey(),
  kind: text('kind').notNull(),
  operations: integer('operations').notNull(),
  skipped: jsonb('skipped').$type<string[]>().notNull(),
  readAt: timestamp('read_at').notNull(),
});

export const specOperation = pgTable(
  'spec_operation',
  {
    hash: text('hash')
      .notNull()
      .references(() => specDocument.hash, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    operation: jsonb('operation').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.hash, table.name] })],
);
