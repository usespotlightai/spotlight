import { timestamptz } from '@platform/persistence/drizzle/columns';
import { INBOX_REQUEST_FORMS } from '@work/domain/value-objects/inbox-request-form';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
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
    taskId: text('task_id').notNull(),
    form: inboxRequestForm('form').notNull(),
    about: text('about').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    resolvedAt: timestamptz('resolved_at'),
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
    index('inbox_request_workspace_created_idx').on(
      table.workspaceId,
      table.createdAt,
      table.id,
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
    readAt: timestamptz('read_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.inboxRequestId, table.userId] })],
);
