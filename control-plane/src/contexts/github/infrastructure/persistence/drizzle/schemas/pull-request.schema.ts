import { timestamptz } from '@platform/persistence/drizzle/columns';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export interface StoredReview {
  readonly id: number;
  readonly state: 'approved' | 'changes-requested' | 'commented';
  readonly login: string | null;
  readonly byBot: boolean;
  readonly at: string | null;
}

export type StoredRevertTarget =
  | { readonly kind: 'number'; readonly number: number }
  | { readonly kind: 'title'; readonly title: string };

export interface StoredBotComment {
  readonly id: number;
  readonly on: 'line' | 'conversation';
  readonly login: string;
  readonly opensThread: boolean;
  readonly deleted: boolean;
}

export interface StoredThread {
  readonly id: string;
  readonly firstCommentId: number | null;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly resolved: boolean;
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
    openedAt: timestamptz('opened_at').notNull(),
    draft: boolean('draft').notNull().default(false),
    readyForReviewAt: timestamptz('ready_for_review_at'),
    draftPeriods: jsonb('draft_periods')
      .$type<StoredDraftPeriod[]>()
      .notNull()
      .default([]),
    state: githubPullRequestState('state').notNull(),
    closedAt: timestamptz('closed_at'),
    updatedAt: timestamptz('updated_at').notNull(),
    reverts: jsonb('reverts').$type<StoredRevertTarget>(),
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
      .$type<StoredBotComment[]>()
      .notNull()
      .default([]),
    threads: jsonb('threads').$type<StoredThread[]>().notNull().default([]),
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
