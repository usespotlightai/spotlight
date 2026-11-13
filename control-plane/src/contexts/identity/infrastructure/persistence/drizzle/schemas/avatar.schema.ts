import { timestamptz } from '@platform/persistence/drizzle/columns';
import {
  integer,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const avatar = pgTable(
  'avatar',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id'),
    digest: text('digest').notNull(),
    imageId: uuid('image_id').notNull(),
    version: integer('version').default(0).notNull(),
    updatedAt: timestamptz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('avatar_owner_idx')
      .on(table.workspaceId, table.teamId)
      .nullsNotDistinct(),
  ],
);
