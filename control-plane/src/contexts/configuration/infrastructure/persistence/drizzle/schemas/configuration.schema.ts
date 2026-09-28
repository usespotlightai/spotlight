import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    definedAt: timestamp('defined_at')
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
    definedAt: timestamp('defined_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.teamId, table.key)],
);
