import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PULL_REQUEST_REVIEWS = Symbol('PULL_REQUEST_REVIEWS');

export type ReviewEvent = 'comment' | 'approve' | 'request-changes';

export type ReviewSide = 'new' | 'old';

export interface OnGitHub {
  readonly id: number;
  readonly url: string;
}

export type ReviewActor =
  | {
      readonly kind: 'person';
      readonly userId: UserId;
      readonly name: string;
    }
  | { readonly kind: 'spotlight' };

export const SPOTLIGHT_ACTOR: ReviewActor = { kind: 'spotlight' };

export interface OnPullRequest {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: PullRequestUrl;
  readonly by: ReviewActor;
}

export interface FileComment {
  readonly path: string;
  readonly body: string;
}

export interface LineComment extends FileComment {
  readonly side: ReviewSide;
  readonly line: number;
  readonly startLine: number | null;
}

export interface SubmittedReview {
  readonly githubId: number;
  readonly comments: readonly (OnGitHub | null)[];
}

export interface PullRequestReviewsPort {
  submit(
    input: OnPullRequest & {
      readonly event: ReviewEvent;
      readonly body: string;
      readonly comments: readonly LineComment[];
    },
  ): Promise<SubmittedReview>;

  reply(
    input: OnPullRequest & { readonly to: number; readonly body: string },
  ): Promise<OnGitHub>;

  commentOnFile(input: OnPullRequest & FileComment): Promise<OnGitHub>;

  edit(
    input: OnPullRequest & {
      readonly commentId: number;
      readonly body: string;
    },
  ): Promise<void>;

  remove(input: OnPullRequest & { readonly commentId: number }): Promise<void>;
}
