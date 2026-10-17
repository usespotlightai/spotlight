import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AccessibleRepositoriesPort } from '@work/application/ports/accessible-repositories.port';

export class GitHubAccessibleRepositories
  implements AccessibleRepositoriesPort
{
  constructor(private readonly catalog: RepositoryCatalogPort) {}

  async isAccessible(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<boolean> {
    try {
      const listed = await this.catalog.list(workspaceId);

      return listed.some((each) =>
        repository.equals(Repository.of(each.fullName)),
      );
    } catch (error) {
      if (error instanceof NoGitHubInstallationError) {
        return false;
      }
      throw error;
    }
  }
}
