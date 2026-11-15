import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { CommitPullRequestsPort } from '@insights/application/ports/commit-pull-requests.port';
import type { CommitPullRequest } from '@insights/domain/aggregates/claims-source.aggregate';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import type { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const unanswerable = (error: unknown): boolean =>
  error instanceof NoGitHubInstallationError ||
  error instanceof RepositoryUnreachableError ||
  (error instanceof UpstreamError && !error.retryable);

export class CommitPullRequests implements CommitPullRequestsPort {
  constructor(private readonly pullRequests: PullRequestPort) {}

  async of(
    workspaceId: WorkspaceId,
    commit: SourceCommit,
  ): Promise<readonly CommitPullRequest[]> {
    try {
      return await this.pullRequests.ofCommit(
        workspaceId,
        commit.repository,
        commit.sha,
      );
    } catch (error) {
      if (unanswerable(error)) {
        return [];
      }
      throw error;
    }
  }
}
