import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type {
  TeamIntegrationReading,
  TeamIntegrationReadingsPort,
} from '@integrations/application/ports/team-integration-readings.port';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamIntegrationReadings implements TeamIntegrationReadingsPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
  ) {}

  async ofTeam(teamId: TeamId): Promise<readonly TeamIntegrationReading[]> {
    return this.reader
      .read(await this.defined.ofTeam(teamId))
      .integrations.map((each) => ({
        integration: each.integration,
        path: each.path,
        name: each.name,
        logo: each.logo,
        requiresConnection: each.requiresConnection,
        actsAs: each.actsAs,
        spec: each.spec
          ? {
              kind: each.spec.kind,
              tools: each.spec.tools,
              readAt: each.spec.readAt,
              problem: each.spec.problem,
            }
          : null,
      }));
  }
}
