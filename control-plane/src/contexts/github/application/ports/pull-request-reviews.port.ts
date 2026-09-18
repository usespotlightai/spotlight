import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PULL_REQUEST_REVIEWS = Symbol('PULL_REQUEST_REVIEWS');

export type ReviewVerdict = 'comment' | 'approve' | 'request-changes';

export type ReviewSide = 'new' | 'old';

export interface OnGitHub {
  readonly id: number;
  readonly url: string;
}

export interface ReviewWriter {
  readonly userId: UserId;
  readonly name: string;
}

export interface OnPullRequest {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly by: ReviewWriter;
}

export interface LineComment {
  readonly path: string;
  readonly side: ReviewSide;
  readonly line: number;
  readonly startLine: number | null;
  readonly body: string;
}

export interface SubmittedReview {
  readonly githubId: number;
  readonly comments: readonly (OnGitHub | null)[];
}

export interface PullRequestReviewsPort {
  submit(
    input: OnPullRequest & {
      readonly verdict: ReviewVerdict;
      readonly body: string;
      readonly comments: readonly LineComment[];
    },
  ): Promise<SubmittedReview>;

  reply(
    input: OnPullRequest & { readonly to: number; readonly body: string },
  ): Promise<OnGitHub>;

  edit(
    input: OnPullRequest & {
      readonly commentId: number;
      readonly body: string;
    },
  ): Promise<void>;

  remove(input: OnPullRequest & { readonly commentId: number }): Promise<void>;
}
