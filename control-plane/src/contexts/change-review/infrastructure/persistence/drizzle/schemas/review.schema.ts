import { REVIEW_DELIVERY_KINDS } from '@change-review/application/ports/review-deliveries.port';
import {
  REVIEW_STATES,
  REVIEW_VERDICTS,
} from '@change-review/domain/aggregates/review.aggregate';
import { REVIEW_COMMENT_STATES } from '@change-review/domain/aggregates/review-comment.aggregate';
import { DELIVERY_FAILURE_CODES } from '@change-review/domain/value-objects/delivery-failure.vo';
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
export const reviewDeliveryKind = pgEnum(
  'review_delivery_kind',
  REVIEW_DELIVERY_KINDS,
);
export const deliveryFailureCode = pgEnum(
  'delivery_failure_code',
  DELIVERY_FAILURE_CODES,
);
export const reviewDeliveryState = pgEnum('review_delivery_state', [
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
    reviewId: text('review_id'),
    state: reviewCommentState('state').notNull(),
    githubId: bigint('github_id', { mode: 'number' }),
    githubUrl: text('github_url'),
    sentBody: text('sent_body'),
    editPending: boolean('edit_pending').notNull(),
    pendingOwnEdits: jsonb('pending_own_edits').$type<string[]>().notNull(),
    createdAt: timestamptz('created_at').notNull(),
    editedAt: timestamptz('edited_at'),
    failureCode: deliveryFailureCode('failure_code'),
    failureDetail: text('failure_detail'),
    version: integer('version').notNull(),
  },
  (table) => [
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
    verdictOnGitHub: reviewVerdict('verdict_on_github'),
    submittedAt: timestamptz('submitted_at').notNull(),
    postedAt: timestamptz('posted_at'),
    failureCode: deliveryFailureCode('failure_code'),
    failureDetail: text('failure_detail'),
    version: integer('version').notNull(),
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
    index('review_included_comment_comment_idx').on(table.commentId),
  ],
);

export const reviewDelivery = pgTable(
  'review_delivery',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id').notNull(),
    kind: reviewDeliveryKind('kind').notNull(),
    reviewId: text('review_id'),
    commentId: text('comment_id'),
    state: reviewDeliveryState('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    dueAt: timestamptz('due_at').notNull(),
    sendingSince: timestamptz('sending_since'),
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (table) => [
    check('review_delivery_attempts_not_negative', sql`${table.attempts} >= 0`),
    index('review_delivery_due_idx').on(table.state, table.dueAt),
    index('review_delivery_task_idx').on(table.taskId),
    index('review_delivery_review_idx').on(table.reviewId),
    index('review_delivery_comment_idx').on(table.commentId),
    check(
      'review_delivery_one_subject',
      sql`(${table.kind} = 'review') = (${table.reviewId} is not null) and num_nonnulls(${table.reviewId}, ${table.commentId}) = 1`,
    ),
  ],
);
