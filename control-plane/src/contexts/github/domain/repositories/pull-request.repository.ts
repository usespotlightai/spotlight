import type { PullRequest } from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestRepository {
  at(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
  ): Promise<PullRequest | null>;

  numbered(
    workspaceId: WorkspaceId,
    repository: Repository,
    number: number,
  ): Promise<PullRequest | null>;

  lastMergedTitled(
    workspaceId: WorkspaceId,
    repository: Repository,
    title: string,
  ): Promise<PullRequest | null>;

  lastUpdatedBefore(
    before: Date,
    after: PullRequest | null,
    max: number,
  ): Promise<readonly PullRequest[]>;

  ofWorkspace(
    workspaceId: WorkspaceId,
    after: PullRequestUrl | null,
    max: number,
  ): Promise<readonly PullRequest[]>;

  lockedAt(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
  ): Promise<PullRequest | null>;

  lockedUnlessBusy(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
  ): Promise<PullRequest | null>;

  add(pullRequest: PullRequest): Promise<void>;

  save(pullRequest: PullRequest): Promise<void>;

  remove(pullRequest: PullRequest): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
