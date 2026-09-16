import { integrationFilesIn } from '@application/contracts/configuration-layout.contract';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import type { SetupState } from '@domain/services/setup-list';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface TeamFacts {
  readonly hasRunner: boolean;
  readonly connectedToGitHub: boolean;
  readonly installation: GitHubInstallation | null;
  readonly configRepository: string | null;
  readonly hasConfiguration: boolean;
  readonly listening: readonly string[];
}

export const asSetupState = (facts: TeamFacts): SetupState => ({
  hasRunner: facts.hasRunner,
  connectedToGitHub: facts.connectedToGitHub,
  hasRepository: facts.configRepository !== null,
  hasConfiguration: facts.hasConfiguration,
  listensToAnIntegration: facts.listening.length > 0,
});

export class TeamSetup {
  constructor(
    private readonly connections: WorkspaceConnections,
    private readonly configurations: TeamConfigurationRepository,
    private readonly integrations: IntegrationReaderPort,
    private readonly runners: RunnerReaderPort,
    private readonly teams: TeamRepository,
  ) {}

  async factsFor(workspaceId: WorkspaceId, teamId: TeamId): Promise<TeamFacts> {
    const [connection, applied, hasRunner, held] = await Promise.all([
      this.connections.connectionTo(workspaceId, GitHubInstallation.SOURCE),
      this.configurations.findFor(teamId),
      this.runners.anyConnected(),
      this.teams.find(teamId),
    ]);

    return {
      hasRunner,
      connectedToGitHub: connection !== null,
      installation: GitHubInstallation.from(connection),
      configRepository: held?.configRepository?.value ?? null,
      hasConfiguration: applied !== null,
      listening: applied
        ? this.integrations
            .read(integrationFilesIn(applied.files))
            .integrations.map((each) => each.source.value)
        : [],
    };
  }
}
