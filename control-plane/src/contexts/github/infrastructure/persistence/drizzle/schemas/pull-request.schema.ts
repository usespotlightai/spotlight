import type { WebhookReview } from '@github/domain/aggregates/pull-request.aggregate';
import type { RevertTarget } from '@github/domain/services/revert-convention';
import type {
  BotComment,
  PullRequestThread,
} from '@github/domain/value-objects/bot-activity.vo';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface StoredReview extends Omit<WebhookReview, 'at'> {
  readonly at: string | null;
}

export interface StoredDraftPeriod {
  readonly from: string;
  readonly to: string | null;
}

export const githubPullRequestState = pgEnum('github_pull_request_state', [
  'open',
  'merged',
  'closed',
]);

export const githubPullRequest = pgTable(
  'github_pull_request',
  {
    workspaceId: text('workspace_id').notNull(),
    url: text('url').notNull(),
    repository: text('repository').notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    author: text('author'),
    authorIsBot: boolean('author_is_bot').notNull().default(false),
    branch: text('branch'),
    additions: integer('additions'),
    deletions: integer('deletions'),
    changedFiles: integer('changed_files'),
    openedAt: timestamp('opened_at').notNull(),
    draft: boolean('draft').notNull().default(false),
    readyForReviewAt: timestamp('ready_for_review_at'),
    draftPeriods: jsonb('draft_periods')
      .$type<StoredDraftPeriod[]>()
      .notNull()
      .default([]),
    state: githubPullRequestState('state').notNull(),
    closedAt: timestamp('closed_at'),
    updatedAt: timestamp('updated_at').notNull(),
    reverts: jsonb('reverts').$type<RevertTarget>(),
    reviews: jsonb('reviews').$type<StoredReview[]>().notNull().default([]),
    dismissedReviews: jsonb('dismissed_reviews')
      .$type<number[]>()
      .notNull()
      .default([]),
    comments: jsonb('comments').$type<number[]>().notNull().default([]),
    deletedComments: jsonb('deleted_comments')
      .$type<number[]>()
      .notNull()
      .default([]),
    botComments: jsonb('bot_comments')
      .$type<BotComment[]>()
      .notNull()
      .default([]),
    threads: jsonb('threads')
      .$type<PullRequestThread[]>()
      .notNull()
      .default([]),
    revertedBy: text('reverted_by'),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.url] }),
    index('github_pull_request_number_idx').on(
      table.workspaceId,
      table.repository,
      table.number,
    ),
    index('github_pull_request_closed_idx').on(table.closedAt),
    index('github_pull_request_updated_idx').on(table.updatedAt),
  ],
);
