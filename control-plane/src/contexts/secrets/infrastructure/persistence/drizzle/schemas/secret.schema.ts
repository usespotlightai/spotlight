import {
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

export const secretGrant = pgTable(
  'secret_grant',
  {
    runId: text('run_id').notNull(),
    secretId: text('secret_id')
      .notNull()
      .references(() => secret.id, { onDelete: 'cascade' }),
    host: text('host').notNull(),
    workspaceId: text('workspace_id').notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.secretId, table.host] }),
  ],
);
