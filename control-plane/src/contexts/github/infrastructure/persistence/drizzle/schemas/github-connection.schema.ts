import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const githubConnection = pgTable('github_connection', {
  workspaceId: text('workspace_id').primaryKey(),
  installationId: text('installation_id').notNull().unique(),
  version: integer('version').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
