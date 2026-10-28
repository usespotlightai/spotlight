import { NOTICE_FORMS } from '@work/domain/value-objects/notice-form';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const noticeForm = pgEnum('notice_form', NOTICE_FORMS);

export const notice = pgTable(
  'notice',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    teamId: text('team_id').notNull(),
    addresseeId: text('addressee_id'),
    form: noticeForm('form').notNull(),
    subject: text('subject').notNull(),
    link: text('link').notNull(),
    linkLabel: text('link_label').notNull(),
    headline: text('headline').notNull(),
    points: jsonb('points').$type<string[]>().notNull(),
    createdAt: timestamp('created_at').notNull(),
    resolvedAt: timestamp('resolved_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    unique('notice_subject_idx')
      .on(table.teamId, table.addresseeId, table.form, table.subject)
      .nullsNotDistinct(),
    index('notice_addressee_idx').on(table.workspaceId, table.addresseeId),
    index('notice_team_idx').on(table.teamId),
  ],
);
