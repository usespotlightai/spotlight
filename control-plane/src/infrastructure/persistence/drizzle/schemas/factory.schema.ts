import {
  team,
  workspace,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const factory = pgTable(
  'factory',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .unique()
      .references(() => team.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('factory_workspace_idx').on(table.workspaceId)],
);
