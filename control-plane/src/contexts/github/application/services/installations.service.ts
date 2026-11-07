import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { GitHubConnectionReaderPort } from '@github/application/ports/github-connection-reader.port';
import type { InstallationsPort } from '@github/application/ports/installations.port';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Installations implements InstallationsPort {
  constructor(private readonly connections: GitHubConnectionReaderPort) {}

  async of(workspaceId: WorkspaceId): Promise<GitHubInstallation> {
    const installation = await this.maybe(workspaceId);

    if (!installation) {
      throw new NoGitHubInstallationError();
    }

    return installation;
  }

  async maybe(workspaceId: WorkspaceId): Promise<GitHubInstallation | null> {
    return this.connections.installationOf(workspaceId);
  }
}
