import type { PullRequestStatus } from '@github/domain/value-objects/pull-request-state.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface NumberedPullRequest {
  readonly repository: Repository;
  readonly number: number;
}

export interface StoredPullRequestSummary extends NumberedPullRequest {
  readonly state: PullRequestStatus;
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly updatedAt: Date;
}

export interface PullRequestSummaryReaderPort {
  summariesOf(
    workspaceId: WorkspaceId,
    pullRequests: readonly NumberedPullRequest[],
  ): Promise<readonly StoredPullRequestSummary[]>;
}
