import { timestamptz } from '@platform/persistence/drizzle/columns';
import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

export const repositoryVisibility = pgTable(
  'repository_visibility',
  {
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    visibility: text('visibility', { enum: ['public', 'private'] }).notNull(),
    checkedAt: timestamptz('checked_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.owner, table.name] })],
);
