import type { CommitPullRequest } from '@insights/domain/aggregates/claims-source.aggregate';
import type { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const COMMIT_PULL_REQUESTS = Symbol('INSIGHTS_COMMIT_PULL_REQUESTS');

export interface CommitPullRequestsPort {
  of(
    workspaceId: WorkspaceId,
    commit: SourceCommit,
  ): Promise<readonly CommitPullRequest[]>;
}
