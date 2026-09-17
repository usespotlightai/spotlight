import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { InstallationsPort } from '@github/application/ports/installations.port';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Installations implements InstallationsPort {
  constructor(private readonly connections: GitHubConnectionRepository) {}

  async of(workspaceId: WorkspaceId): Promise<GitHubInstallation> {
    const installation = await this.maybe(workspaceId);

    if (!installation) {
      throw new NoGitHubInstallationError();
    }

    return installation;
  }

  async maybe(workspaceId: WorkspaceId): Promise<GitHubInstallation | null> {
    return (await this.connections.of(workspaceId)).installation;
  }
}
