import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PULL_REQUEST_REVIEW_LOCKS = Symbol('PULL_REQUEST_REVIEW_LOCKS');

export interface PullRequestReviewLocksPort {
  lock(workspaceId: WorkspaceId, pullRequest: PullRequestUrl): Promise<void>;
}
