import type { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { GitHubIdentityPort } from '@application/ports/github-identity.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class ConnectGitHubHandler
  implements CommandHandlerPort<ConnectGitHubCommand, string | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly identity: GitHubIdentityPort,
    private readonly transaction: TransactionPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: ConnectGitHubCommand): Promise<string | null> {
    try {
      const by = UserId.of(command.viewerId);
      const installation = GitHubInstallation.of(command.installationId);

      const connected = await this.transaction.run(async () => {
        const workspace = await this.workspaces.findBySlug(
          WorkspaceSlug.of(command.slug),
        );

        if (!workspace?.holds(by)) {
          return null;
        }

        const connected = workspace.connectedTo(
          Connection.of(GitHubInstallation.SOURCE, installation.value),
          by,
        );

        // Verified with GitHub: a client-supplied installation id could expose another account's repositories.
        const held = await this.identity.administers(by, installation);

        if (held === 'does-not') {
          throw new NotYoursToConnectError(
            'That is not an installation you administer on GitHub',
          );
        }

        if (held === 'cannot-tell') {
          throw new NotYoursToConnectError(
            'GitHub would not say whether that installation is yours. Sign in again, and if it keeps happening the sign-in is not authorised to list App installations.',
          );
        }

        await this.workspaces.save(connected);

        return connected;
      });

      if (connected) {
        await this.events.dispatch(connected.pullEvents());
      }

      return connected?.id.value ?? null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
