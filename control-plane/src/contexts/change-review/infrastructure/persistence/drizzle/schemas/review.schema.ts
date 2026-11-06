import { REVIEW_OUTBOX_KINDS } from '@change-review/application/ports/review-outbox.port';
import {
  REVIEW_STATES,
  REVIEW_VERDICTS,
} from '@change-review/domain/aggregates/review.aggregate';
import { REVIEW_COMMENT_STATES } from '@change-review/domain/aggregates/review-comment.aggregate';
import { REVIEW_SIDES } from '@change-review/domain/value-objects/review-anchor.vo';
import { timestamptz } from '@platform/persistence/drizzle/columns';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const reviewCommentState = pgEnum(
  'review_comment_state',
  REVIEW_COMMENT_STATES,
);
export const reviewSide = pgEnum('review_side', REVIEW_SIDES);
export const reviewVerdict = pgEnum('review_verdict', REVIEW_VERDICTS);
export const reviewState = pgEnum('review_state', REVIEW_STATES);
export const reviewOutboxKind = pgEnum(
  'review_outbox_kind',
  REVIEW_OUTBOX_KINDS,
);
export const reviewOutboxState = pgEnum('review_outbox_state', [
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
    side: reviewSide('side'),
    line: integer('line'),
    startLine: integer('start_line'),
    body: text('body').notNull(),
    authorId: text('author_id'),
    authorRunId: text('author_run_id'),
    authorLogin: text('author_login'),
    authorName: text('author_name').notNull(),
    replyToId: text('reply_to_id'),
    reviewId: text('review_id').references(() => review.id, {
      onDelete: 'set null',
    }),
    state: reviewCommentState('state').notNull(),
    githubId: bigint('github_id', { mode: 'number' }),
    githubUrl: text('github_url'),
    sentBody: text('sent_body'),
    editPending: boolean('edit_pending').notNull().default(false),
    pendingOwnEdits: jsonb('pending_own_edits')
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamptz('created_at').notNull(),
    editedAt: timestamptz('edited_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    unique('review_comment_workspace_id_id_key').on(
      table.workspaceId,
      table.id,
    ),
    index('review_comment_reply_to_idx').on(table.replyToId),
    index('review_comment_review_idx').on(table.reviewId),
    index('review_comment_task_idx').on(table.taskId, table.createdAt),
    uniqueIndex('review_comment_github_idx').on(
      table.workspaceId,
      table.githubId,
    ),
    check(
      'review_comment_lines_check',
      sql`(${table.side} is null) = (${table.line} is null) and (${table.line} is not null or ${table.startLine} is null)`,
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
    state: reviewState('state').notNull(),
    githubId: bigint('github_id', { mode: 'number' }),
    submittedAt: timestamptz('submitted_at').notNull(),
    postedAt: timestamptz('posted_at'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    unique('review_workspace_id_id_key').on(table.workspaceId, table.id),
    index('review_task_idx').on(table.taskId, table.submittedAt),
  ],
);

export const reviewIncludedComment = pgTable(
  'review_included_comment',
  {
    reviewId: text('review_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    commentId: text('comment_id').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    check(
      'review_included_comment_position_not_negative',
      sql`${table.position} >= 0`,
    ),
    primaryKey({ columns: [table.reviewId, table.commentId] }),
    uniqueIndex('review_included_comment_position_idx').on(
      table.reviewId,
      table.position,
    ),
    foreignKey({
      name: 'review_included_comment_review_fk',
      columns: [table.workspaceId, table.reviewId],
      foreignColumns: [review.workspaceId, review.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'review_included_comment_comment_fk',
      columns: [table.workspaceId, table.commentId],
      foreignColumns: [reviewComment.workspaceId, reviewComment.id],
    }),
    index('review_included_comment_comment_idx').on(table.commentId),
  ],
);

export const reviewOutbox = pgTable(
  'review_outbox',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    kind: reviewOutboxKind('kind').notNull(),
    reviewId: text('review_id'),
    commentId: text('comment_id'),
    state: reviewOutboxState('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamptz('due_at').notNull(),
    failure: text('failure'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('review_outbox_attempts_not_negative', sql`${table.attempts} >= 0`),
    index('review_outbox_due_idx').on(table.state, table.dueAt),
    index('review_outbox_task_idx').on(table.taskId),
    index('review_outbox_review_idx').on(table.reviewId),
    index('review_outbox_comment_idx').on(table.commentId),
    check(
      'review_outbox_one_subject',
      sql`(${table.kind} = 'review') = (${table.reviewId} is not null) and num_nonnulls(${table.reviewId}, ${table.commentId}) = 1`,
    ),
    foreignKey({
      name: 'review_outbox_review_fk',
      columns: [table.workspaceId, table.reviewId],
      foreignColumns: [review.workspaceId, review.id],
    }),
    foreignKey({
      name: 'review_outbox_comment_fk',
      columns: [table.workspaceId, table.commentId],
      foreignColumns: [reviewComment.workspaceId, reviewComment.id],
    }),
  ],
);
