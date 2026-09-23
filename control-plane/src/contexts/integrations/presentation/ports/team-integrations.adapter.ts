import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';

export class TeamIntegrations implements TeamIntegrationsPort {
  constructor(private readonly readings: IntegrationReaderPort) {}

  async offered(teamId: TeamId): Promise<readonly ToolDeclaration[]> {
    return (await this.readings.ofTeam(teamId)).integrations.flatMap(
      (each) => each.offers,
    );
  }
}
