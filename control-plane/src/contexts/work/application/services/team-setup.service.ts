import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ConfigurationStatusPort } from '@work/application/ports/configuration-status.port';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';
import type { SetupState } from '@work/domain/services/setup-list';

export interface TeamFacts {
  readonly hasRunner: boolean;
  readonly connectedToGitHub: boolean;
  readonly hasConfiguration: boolean;
  readonly listening: readonly string[];
}

export const asSetupState = (facts: TeamFacts): SetupState => ({
  hasRunner: facts.hasRunner,
  connectedToGitHub: facts.connectedToGitHub,
  hasConfiguration: facts.hasConfiguration,
  listensToAnIntegration: facts.listening.length > 0,
});

export class TeamSetup {
  constructor(
    private readonly connections: WorkspaceConnectionsPort,
    private readonly configurations: ConfigurationStatusPort,
    private readonly integrations: TeamIntegrationsPort,
    private readonly runners: RunnerReaderPort,
  ) {}

  async factsFor(workspaceId: WorkspaceId, teamId: TeamId): Promise<TeamFacts> {
    const [connected, applied, hasRunner] = await Promise.all([
      this.connections.isConnected(workspaceId),
      this.configurations.isApplied(teamId),
      this.runners.anyConnected(workspaceId),
    ]);

    return {
      hasRunner,
      connectedToGitHub: connected,
      hasConfiguration: applied,
      listening: applied ? await this.integrations.listening(teamId) : [],
    };
  }
}
