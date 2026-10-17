import { ASIDE_FORMS } from '@work/domain/value-objects/aside-form';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const asideForm = pgEnum('aside_form', ASIDE_FORMS);

export const taskAside = pgTable(
  'task_aside',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    form: asideForm('form').notNull(),
    about: text('about').notNull(),
    raisedAt: timestamp('raised_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('task_aside_about_idx').on(
      table.taskId,
      table.form,
      table.about,
    ),
    index('task_aside_workspace_idx').on(table.workspaceId, table.resolvedAt),
  ],
);

export const taskAsideRead = pgTable(
  'task_aside_read',
  {
    asideId: text('aside_id')
      .notNull()
      .references(() => taskAside.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    readAt: timestamp('read_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.asideId, table.userId] })],
);
