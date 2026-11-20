import type { PullRequestStatus } from '@github/domain/value-objects/pull-request-state.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface NumberedPullRequest {
  readonly repository: Repository;
  readonly number: number;
}

export interface PullRequestWithStatus extends NumberedPullRequest {
  readonly status: PullRequestStatus;
}

export interface PullRequestStatusReaderPort {
  statusesOf(
    workspaceId: WorkspaceId,
    pullRequests: readonly NumberedPullRequest[],
  ): Promise<readonly PullRequestWithStatus[]>;
}
