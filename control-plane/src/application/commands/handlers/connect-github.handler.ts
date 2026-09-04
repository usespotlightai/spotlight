import type { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { GitHubIdentityPort } from '@application/ports/github-identity.port';
import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { SeedConfiguration } from '@application/services/seed-configuration.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { WorkspaceConnected } from '@domain/events/workspace-connected.event';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class ConnectGitHubHandler
  implements CommandHandlerPort<ConnectGitHubCommand, string | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly identity: GitHubIdentityPort,
    private readonly transaction: TransactionPort,
    private readonly catalog: RepositoryCatalogPort,
    private readonly teams: TeamRepository,
    private readonly seeding: SeedConfiguration,
    private readonly settling: SettleSetup,
  ) {}

  /** The workspace connected, or null where this person has no such one. */
  async execute(command: ConnectGitHubCommand): Promise<string | null> {
    try {
      const by = UserId.of(command.viewerId);
      const installation = GitHubInstallation.of(command.installationId);

      const connected = await this.transaction.run(async () => {
        const workspace = await this.workspaces.findBySlug(
          WorkspaceSlug.of(command.slug),
        );

        // Someone outside it is not told a workspace is there at all.
        if (!workspace?.holds(by)) {
          return null;
        }

        // The workspace says whether this is theirs to connect, and refuses
        // before anything is asked of GitHub on their behalf.
        const connected = workspace.connectedTo(
          Connection.of(GitHubInstallation.SOURCE, installation.value),
          by,
        );

        // Asked of GitHub, not taken from the request: an installation number
        // is a guess anyone could make, and the wrong one would hand this
        // workspace somebody else's repositories.
        const held = await this.identity.administers(by, installation);

        if (held === 'does-not') {
          throw new NotYoursToConnectError(
            'That is not an installation you administer on GitHub',
          );
        }

        // Refused either way, but said as what it is. A question GitHub would
        // not answer is not an answer of no.
        if (held === 'cannot-tell') {
          throw new NotYoursToConnectError(
            'GitHub would not say whether that installation is yours. Sign in again, and if it keeps happening the sign-in is not authorised to list App installations.',
          );
        }

        await this.workspaces.save(connected);

        return connected;
      });

      if (!connected) {
        return null;
      }

      // Dispatched afterwards, and outside the transaction: opening a pull
      // request is somebody else's machine answering, and connecting is not
      // to be held open on it or undone by it.
      for (const event of connected.happened) {
        if (event instanceof WorkspaceConnected) {
          await this.wroteItDown(connected);
          await this.settling.forWorkspace(connected.id);
        }
      }

      return connected.id.value;
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  /**
   * The pull request that opens a workspace's configuration, into whichever
   * repository comes first. Nothing is pinned: the same rule that finds
   * configuration afterwards is the one that chose where to put it.
   */
  private async wroteItDown(workspace: Workspace): Promise<void> {
    const installation = GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );

    if (!installation) {
      return;
    }

    const [first] = await this.catalog.list(installation);

    if (!first) {
      return;
    }

    // Each team's own, so a workspace with two of them opens two: a team
    // reads its configuration from a repository of its choosing, and this
    // is the first guess at which.
    for (const team of await this.teams.ofWorkspace(workspace.id)) {
      await this.seeding.trySeed(
        workspace,
        team,
        team.configRepository ?? Repository.of(first.fullName),
      );
    }
  }
}
