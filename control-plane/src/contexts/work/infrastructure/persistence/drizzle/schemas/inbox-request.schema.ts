import { INBOX_REQUEST_FORMS } from '@work/domain/value-objects/inbox-request-form';
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

export const inboxRequestForm = pgEnum(
  'inbox_request_form',
  INBOX_REQUEST_FORMS,
);

export const inboxRequest = pgTable(
  'inbox_request',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    form: inboxRequestForm('form').notNull(),
    about: text('about').notNull(),
    createdAt: timestamp('created_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    uniqueIndex('inbox_request_about_idx').on(
      table.taskId,
      table.form,
      table.about,
    ),
    index('inbox_request_workspace_idx').on(
      table.workspaceId,
      table.resolvedAt,
    ),
  ],
);

export const inboxRequestRead = pgTable(
  'inbox_request_read',
  {
    inboxRequestId: text('inbox_request_id')
      .notNull()
      .references(() => inboxRequest.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    readAt: timestamp('read_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.inboxRequestId, table.userId] })],
);
