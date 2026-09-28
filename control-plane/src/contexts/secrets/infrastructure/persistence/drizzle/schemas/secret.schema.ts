import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export interface SecretBindingRow {
  readonly host: string;
  readonly header: string;
  readonly prefix: string;
}

export const secret = pgTable(
  'secret',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    source: text('source').notNull(),
    sourceSecretId: text('source_secret_id'),
    sourceField: text('source_field'),
    bindings: jsonb('bindings').$type<SecretBindingRow[]>().notNull(),
    valueVersion: integer('value_version'),
    rotatedAt: timestamp('rotated_at').notNull(),
    version: integer('version').notNull().default(1),
    definedAt: timestamp('defined_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.workspaceId, table.name)],
);

export const secretValue = pgTable('secret_value', {
  secretId: text('secret_id')
    .primaryKey()
    .references(() => secret.id, { onDelete: 'cascade' }),
  sealed: text('sealed').notNull(),
  keptAt: timestamp('kept_at').defaultNow().notNull(),
});

export const secretDataKey = pgTable('secret_data_key', {
  workspaceId: text('workspace_id').primaryKey(),
  keyId: text('key_id').notNull(),
  wrapped: text('wrapped').notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
});

export const runGrants = pgTable(
  'run_grants',
  {
    runId: text('run_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    attempt: integer('attempt').notNull(),
    recipient: text('recipient'),
    holdLost: boolean('hold_lost').notNull().default(false),
    endedAt: timestamp('ended_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('run_grants_workspace_idx').on(table.workspaceId),
    index('run_grants_ended_idx').on(table.endedAt),
  ],
);

export const secretGrant = pgTable(
  'secret_grant',
  {
    runId: text('run_id')
      .notNull()
      .references(() => runGrants.runId, { onDelete: 'cascade' }),
    secretId: text('secret_id').notNull(),
    host: text('host').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.secretId, table.host] }),
  ],
);
