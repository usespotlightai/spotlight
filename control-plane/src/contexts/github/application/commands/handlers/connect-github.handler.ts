import type { ConnectGitHubCommand } from '@github/application/commands/connect-github.command';
import { InstallationUnverifiableError } from '@github/application/errors/installation-unverifiable.error';
import type { InstallationAdministrationPort } from '@github/application/ports/installation-administration.port';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ConnectGitHubHandler
  implements CommandHandlerPort<ConnectGitHubCommand, string | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly connections: GitHubConnectionRepository,
    private readonly administration: InstallationAdministrationPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: ConnectGitHubCommand): Promise<string | null> {
    try {
      const by = UserId.of(command.viewerId);
      const installation = GitHubInstallation.of(command.installationId);
      const membership = await this.access.inWorkspace(command.slug, by);

      if (!membership) {
        return null;
      }

      const administration = membership.administers
        ? await this.administration.of(installation, by)
        : 'does-not';

      if (administration === 'cannot-tell') {
        throw new InstallationUnverifiableError();
      }

      await this.transaction.run(async () => {
        const claimedBy = await this.connections.claimantOf(installation);
        const connection = await this.connections.of(membership.workspaceId);

        await this.connections.save(
          connection.connectedTo(installation, {
            workspaceAdministered: membership.administers,
            installationAdministered: administration === 'administers',
            claimedBy,
          }),
        );
      });

      return membership.workspaceId.value;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
