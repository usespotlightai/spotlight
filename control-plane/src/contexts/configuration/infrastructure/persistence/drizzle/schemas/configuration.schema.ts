import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const teamVaultKey = pgTable('team_vault_key', {
  teamId: text('team_id').primaryKey(),
  sealedKey: text('sealed_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamConfig = pgTable('team_config', {
  teamId: text('team_id').primaryKey(),
  repository: text('repository').notNull(),
  sha: text('sha').notNull(),
  files: jsonb('files').$type<{ path: string; text: string }[]>().notNull(),
  problems: jsonb('problems')
    .$type<
      {
        path: string;
        at: string;
        reason: string;
        severity: 'error' | 'warning';
      }[]
    >()
    .notNull(),
  integrations: jsonb('integrations')
    .$type<
      {
        source: string;
        name: string;
        path: string;
        connectable: boolean;
      }[]
    >()
    .notNull()
    .default([]),
  begunAt: timestamp('begun_at').notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
});

export const configurationHome = pgTable('configuration_home', {
  teamId: text('team_id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  keptIn: text('kept_in'),
  movingTo: text('moving_to'),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
