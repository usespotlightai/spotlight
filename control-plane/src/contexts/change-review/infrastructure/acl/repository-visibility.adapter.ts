import type { RepositoryVisibilityPort } from '@change-review/application/ports/repository-visibility.port';
import type { RepositoryVisibilityPort as GitHubRepositoryVisibilityPort } from '@github/application/ports/repository-visibility.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RepositoryVisibility implements RepositoryVisibilityPort {
  constructor(private readonly visibility: GitHubRepositoryVisibilityPort) {}

  arePublic(
    workspaceId: WorkspaceId,
    repositories: readonly Repository[],
  ): Promise<boolean> {
    return this.visibility.arePublic(workspaceId, repositories);
  }
}
