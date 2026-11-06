import { timestamptz } from '@platform/persistence/drizzle/columns';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const githubConnection = pgTable('github_connection', {
  workspaceId: text('workspace_id').primaryKey(),
  installationId: text('installation_id').notNull().unique(),
  version: integer('version').default(0).notNull(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});
