import type { ReviewVerdict } from '@change-review/domain/aggregates/review.aggregate';
import type { OnGitHub } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewSide } from '@change-review/domain/value-objects/review-anchor.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type ReviewPoster =
  | {
      readonly kind: 'person';
      readonly userId: UserId;
      readonly name: string;
    }
  | { readonly kind: 'spotlight' };

export const SPOTLIGHT_POSTER: ReviewPoster = { kind: 'spotlight' };

export interface PostingTarget {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly by: ReviewPoster;
}

interface LineReviewComment {
  readonly path: string;
  readonly side: ReviewSide;
  readonly line: number;
  readonly startLine: number | null;
  readonly body: string;
}

export interface PostedReview {
  readonly githubId: number;
  readonly verdict: ReviewVerdict;
  readonly comments: readonly (OnGitHub | null)[];
}

export interface ReviewPostingPort {
  submit(
    input: PostingTarget & {
      readonly verdict: ReviewVerdict;
      readonly body: string;
      readonly comments: readonly LineReviewComment[];
    },
  ): Promise<PostedReview>;

  reply(
    input: PostingTarget & { readonly thread: number; readonly body: string },
  ): Promise<OnGitHub>;

  commentOnFile(
    input: PostingTarget & { readonly path: string; readonly body: string },
  ): Promise<OnGitHub>;

  edit(
    input: PostingTarget & {
      readonly commentId: number;
      readonly body: string;
    },
  ): Promise<void>;

  remove(input: PostingTarget & { readonly commentId: number }): Promise<void>;
}
