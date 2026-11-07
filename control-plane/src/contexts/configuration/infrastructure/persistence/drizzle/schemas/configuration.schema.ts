import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const skillDefinition = pgTable(
  'skill_definition',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    key: text('key').notNull(),
    files: jsonb('files').$type<Record<string, string>>().notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.key)],
);

export interface PermissionsRow {
  readonly allow: readonly string[];
  readonly ask: readonly string[];
  readonly deny: readonly string[];
}

export interface McpServerRow {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export const harnessProfile = pgTable(
  'harness_profile',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull(),
    key: text('key').notNull(),
    permissions: jsonb('permissions').$type<PermissionsRow>().notNull(),
    mcpServers: jsonb('mcp_servers').$type<McpServerRow[]>().notNull(),
    native: jsonb('native').$type<Record<string, unknown>>().notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.key)],
);

export interface StateLockRow {
  readonly id: string;
  readonly info: Record<string, unknown>;
  readonly lockedBy: string;
  readonly lockedAt: string;
}

export const terraformState = pgTable(
  'terraform_state',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    lock: jsonb('lock').$type<StateLockRow>(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.workspaceId, table.name)],
);

export const terraformStateVersion = pgTable(
  'terraform_state_version',
  {
    id: text('id').primaryKey(),
    stateId: text('state_id')
      .notNull()
      .references(() => terraformState.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    serial: integer('serial').notNull(),
    lineage: text('lineage').notNull(),
    md5: text('md5').notNull(),
    size: integer('size').notNull(),
    writtenBy: text('written_by').notNull(),
    writtenAt: timestamptz('written_at').notNull(),
  },
  (table) => [
    unique().on(table.stateId, table.number),
    check('terraform_state_version_size_not_negative', sql`${table.size} >= 0`),
  ],
);
