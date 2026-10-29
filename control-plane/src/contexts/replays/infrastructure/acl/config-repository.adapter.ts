import { BranchTakenError } from '@github/application/errors/branch-taken.error';
import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import { RepositoryFileUnwritableError } from '@github/application/errors/repository-file-unwritable.error';
import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type {
  ConfigCommit,
  ConfigFile,
  ConfigPullRequestAt,
  ConfigPullRequestOpening,
  ConfigPullRequestStatus,
  ConfigRepositoryPort,
  OpenedConfigPullRequest,
} from '@replays/application/ports/config-repository.port';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const withRepositoryErrors = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    if (
      error instanceof RepositoryUnreachableError ||
      error instanceof NoGitHubInstallationError
    ) {
      throw new ConfigRepositoryError('repository-unreachable', error.message);
    }
    if (error instanceof BranchTakenError) {
      throw new ConfigRepositoryError('branch-taken', error.message);
    }
    if (error instanceof RepositoryFileUnwritableError) {
      throw new ConfigRepositoryError('file-unwritable', error.message);
    }
    if (error instanceof UpstreamError && !error.retryable) {
      throw new ConfigRepositoryError('github-error', error.message);
    }
    throw error;
  }
};

export class ConfigRepository implements ConfigRepositoryPort {
  constructor(
    private readonly contents: RepositoryContentsPort,
    private readonly pullRequests: PullRequestPort,
  ) {}

  async fileAt(
    workspaceId: WorkspaceId,
    repository: Repository,
    path: string,
    commit?: string,
  ): Promise<ConfigFile | null> {
    const found = await withRepositoryErrors(() =>
      this.contents.fileAt(workspaceId, repository, path, commit),
    );

    return found
      ? { path, content: found.content, commit: found.commit }
      : null;
  }

  async filesIn(
    workspaceId: WorkspaceId,
    repository: Repository,
    directory: string,
    commit: string,
  ): Promise<readonly string[]> {
    return withRepositoryErrors(() =>
      this.contents.filesIn(workspaceId, repository, directory, commit),
    );
  }

  async committed(
    workspaceId: WorkspaceId,
    repository: Repository,
    commit: ConfigCommit,
  ): Promise<string> {
    return withRepositoryErrors(() =>
      this.contents.committed(workspaceId, repository, {
        branch: commit.branch,
        base: commit.base,
        replacing: commit.replacing,
        message: commit.message,
        files: commit.files.map((each) => ({
          path: each.path,
          content: each.content,
        })),
      }),
    );
  }

  async opened(
    workspaceId: WorkspaceId,
    repository: Repository,
    opening: ConfigPullRequestOpening,
  ): Promise<OpenedConfigPullRequest> {
    const opened = await withRepositoryErrors(() =>
      this.pullRequests.open({
        workspaceId,
        repository,
        branch: opening.branch,
        title: opening.title,
        body: opening.body,
      }),
    );

    return {
      url: opened.url,
      number: opened.number,
      gitHubId: opened.id,
      repository: opened.repository,
    };
  }

  statusOf(
    workspaceId: WorkspaceId,
    pullRequest: ConfigPullRequestAt,
  ): Promise<ConfigPullRequestStatus> {
    return withRepositoryErrors(() =>
      this.pullRequests.statusOf({ workspaceId, ...pullRequest }),
    );
  }

  async closed(
    workspaceId: WorkspaceId,
    pullRequest: ConfigPullRequestAt,
  ): Promise<void> {
    await withRepositoryErrors(() =>
      this.pullRequests.close({ workspaceId, ...pullRequest }),
    );
  }

  async commented(
    workspaceId: WorkspaceId,
    pullRequest: ConfigPullRequestAt,
    body: string,
  ): Promise<void> {
    await withRepositoryErrors(() =>
      this.pullRequests.comment({ workspaceId, ...pullRequest }, body),
    );
  }
}
