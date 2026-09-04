import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import type { SetupState } from '@domain/services/setup-list';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * What a team has and has not got. More than the list needs: where
 * configuration is kept and which tools are listened to are shown to a
 * person, and the list only asks whether there are any.
 */
export interface TeamFacts {
  readonly hasRunner: boolean;
  readonly connectedToGitHub: boolean;
  readonly configRepository: string | null;
  readonly hasConfiguration: boolean;
  readonly listening: readonly string[];
}

export const asSetupState = (facts: TeamFacts): SetupState => ({
  hasRunner: facts.hasRunner,
  connectedToGitHub: facts.connectedToGitHub,
  hasRepository: facts.configRepository !== null,
  hasConfiguration: facts.hasConfiguration,
  listensToATool: facts.listening.length > 0,
});

/**
 * Where a team stands on the list it was opened with, read in one place so
 * the list shown and the list counted cannot disagree.
 *
 * Loads what holds the answers rather than anything kept ready: a team's
 * whole configuration is read to find out whether it listens to anything.
 * Worth knowing before asking this anywhere hotter than opening a page.
 */
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
      configRepository: held?.configRepository?.value ?? null,
      hasConfiguration: applied !== null,
      listening: applied
        ? this.integrations
            .read(applied.under(INTEGRATIONS_UNDER))
            .integrations.map((each) => each.source.value)
        : [],
    };
  }
}
