import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PendingReview {
  readonly pullRequest: PullRequestUrl;
  readonly at: Date;
}

export interface PendingReviewsPort {
  hold(workspaceId: WorkspaceId, review: PendingReview): Promise<void>;

  heldFor(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    since: Date,
  ): Promise<readonly PendingReview[]>;

  release(workspaceId: WorkspaceId, pullRequest: PullRequestUrl): Promise<void>;

  releaseBefore(workspaceId: WorkspaceId, before: Date): Promise<void>;

  releaseWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
