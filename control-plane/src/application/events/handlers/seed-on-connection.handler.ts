import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { SeedConfiguration } from '@application/services/seed-configuration.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { WorkspaceConnected } from '@domain/events/workspace-connected.event';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';

export class SeedOnConnection {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly teams: TeamRepository,
    private readonly catalog: RepositoryCatalogPort,
    private readonly seeding: SeedConfiguration,
    private readonly settling: SettleSetup,
  ) {}

  async onWorkspaceConnected(event: WorkspaceConnected): Promise<void> {
    const workspace = await this.workspaces.find(event.workspaceId);

    if (!workspace) {
      return;
    }

    await this.wroteItDown(workspace);
    await this.settling.forWorkspace(workspace.id);
  }

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

    for (const team of await this.teams.ofWorkspace(workspace.id)) {
      await this.seeding.trySeed(
        workspace,
        team,
        team.configRepository ?? Repository.of(first.fullName),
      );
    }
  }
}
