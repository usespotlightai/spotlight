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
    holder: text('holder').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    scopes: text('scopes').notNull().default(''),
    handle: text('handle'),
    renewalRefusedAt: timestamp('renewal_refused_at'),
    renewalClaimedUntil: timestamp('renewal_claimed_until'),
    version: integer('version').notNull().default(1),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.source, table.holder] }),
    index('host_connection_holder_idx').on(table.teamId, table.holder),
  ],
);

export const oauth2ClientRegistration = pgTable(
  'oauth2_client_registration',
  {
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    source: text('source').notNull(),
    registrationEndpoint: text('registration_endpoint').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret'),
    secretExpiresAt: timestamp('secret_expires_at'),
    version: integer('version').notNull().default(1),
    registeredAt: timestamp('registered_at').notNull().defaultNow(),
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
    sourceFingerprint: text('source_fingerprint'),
    sourceHash: text('source_hash'),
    sourceReadAt: timestamp('source_read_at'),
    sourceProblem: text('source_problem'),
    sourcePassedOver: jsonb('source_passed_over').$type<string[]>(),
    version: integer('version').notNull().default(1),
    definedAt: timestamp('defined_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.source)],
);

export const describedDocument = pgTable('described_document', {
  hash: text('hash').primaryKey(),
  kind: text('kind').notNull(),
  operations: integer('operations').notNull(),
  passedOver: jsonb('passed_over').$type<string[]>().notNull(),
  readAt: timestamp('read_at').notNull(),
});

export const describedOperation = pgTable(
  'described_operation',
  {
    hash: text('hash')
      .notNull()
      .references(() => describedDocument.hash, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    operation: jsonb('operation').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.hash, table.name] })],
);
