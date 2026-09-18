import { REVIEW_SYNC_KINDS } from '@change-review/application/ports/review-outbox.port';
import {
  REVIEW_STATES,
  REVIEW_VERDICTS,
} from '@change-review/domain/aggregates/review.aggregate';
import { REVIEW_COMMENT_STATES } from '@change-review/domain/aggregates/review-comment.aggregate';
import { REVIEW_SIDES } from '@change-review/domain/value-objects/review-anchor.vo';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const reviewCommentState = pgEnum(
  'review_comment_state',
  REVIEW_COMMENT_STATES,
);
export const reviewSide = pgEnum('review_side', REVIEW_SIDES);
export const reviewVerdict = pgEnum('review_verdict', REVIEW_VERDICTS);
export const reviewState = pgEnum('review_state', REVIEW_STATES);
export const reviewSyncKind = pgEnum('review_sync_kind', REVIEW_SYNC_KINDS);
export const reviewSyncState = pgEnum('review_sync_state', [
  'pending',
  'done',
  'failed',
]);

export const reviewComment = pgTable(
  'review_comment',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    path: text('path').notNull(),
    side: reviewSide('side').notNull(),
    line: integer('line').notNull(),
    startLine: integer('start_line'),
    body: text('body').notNull(),
    authorId: text('author_id'),
    authorRunId: text('author_run_id'),
    authorLogin: text('author_login'),
    authorName: text('author_name').notNull(),
    replyToId: text('reply_to_id'),
    reviewId: text('review_id'),
    state: reviewCommentState('state').notNull(),
    githubId: bigint('github_id', { mode: 'number' }),
    githubUrl: text('github_url'),
    sentBody: text('sent_body'),
    editPending: boolean('edit_pending').notNull().default(false),
    editsAwaitingEcho: jsonb('edits_awaiting_echo')
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at').notNull(),
    editedAt: timestamp('edited_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    index('review_comment_task_idx').on(table.taskId, table.createdAt),
    uniqueIndex('review_comment_github_idx').on(
      table.workspaceId,
      table.githubId,
    ),
  ],
);

export const review = pgTable(
  'review',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    authorId: text('author_id'),
    authorRunId: text('author_run_id'),
    authorName: text('author_name'),
    verdict: reviewVerdict('verdict').notNull(),
    body: text('body').notNull(),
    commentIds: jsonb('comment_ids').$type<string[]>().notNull().default([]),
    state: reviewState('state').notNull(),
    githubId: bigint('github_id', { mode: 'number' }),
    submittedAt: timestamp('submitted_at').notNull(),
    postedAt: timestamp('posted_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [index('review_task_idx').on(table.taskId, table.submittedAt)],
);

export const reviewSync = pgTable(
  'review_sync',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    kind: reviewSyncKind('kind').notNull(),
    subjectId: text('subject_id').notNull(),
    state: reviewSyncState('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamp('due_at').notNull(),
    failure: text('failure'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('review_sync_due_idx').on(table.state, table.dueAt),
    index('review_sync_task_idx').on(table.taskId),
  ],
);
