import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { InstallationRepositoriesPort } from '@github/application/ports/installation-repositories.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AccessibleRepositoriesPort } from '@work/application/ports/accessible-repositories.port';

export class GitHubAccessibleRepositories
  implements AccessibleRepositoriesPort
{
  constructor(private readonly repositories: InstallationRepositoriesPort) {}

  async isAccessible(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<boolean> {
    try {
      const listed = await this.repositories.list(workspaceId);

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
