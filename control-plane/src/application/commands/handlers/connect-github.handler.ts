import type { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { GitHubIdentityPort } from '@application/ports/github-identity.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
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
  ) {}

  /** The workspace connected, or null where this person has no such one. */
  async execute(command: ConnectGitHubCommand): Promise<string | null> {
    try {
      const by = UserId.of(command.viewerId);
      const installation = GitHubInstallation.of(command.installationId);

      return await this.transaction.run(async () => {
        const workspace = await this.workspaces.findBySlug(
          WorkspaceSlug.of(command.slug),
        );

        // Someone outside it is not told a workspace is there at all.
        if (!workspace?.holds(by)) {
          return null;
        }

        // The workspace says whether this is theirs to connect, and refuses
        // before anything is asked of GitHub on their behalf.
        const connected = workspace.connectedTo(installation, by);

        // Asked of GitHub, not taken from the request: an installation number
        // is a guess anyone could make, and the wrong one would hand this
        // workspace somebody else's repositories.
        if (!(await this.identity.administers(by, installation))) {
          throw new NotYoursToConnectError(
            'That is not an installation you administer on GitHub',
          );
        }

        await this.workspaces.save(connected);

        return connected.id.value;
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
