import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import type { RepositoryPathsPort } from '@memory/application/ports/repository-paths.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const DEFAULT_BRANCH = 'HEAD';

export class RepositoryPaths implements RepositoryPathsPort {
  constructor(private readonly contents: RepositoryContentsPort) {}

  async pathsAt(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<ReadonlySet<string> | null> {
    const paths = await this.contents.pathsAt(
      workspaceId,
      repository,
      DEFAULT_BRANCH,
    );

    return paths ? new Set(paths) : null;
  }
}
