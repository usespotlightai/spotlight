import type {
  IntegrationReaderPort,
  ReadIntegrations,
} from '@configuration/application/ports/integration-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationReadings implements IntegrationReaderPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
  ) {}

  async ofTeam(teamId: TeamId): Promise<ReadIntegrations> {
    return this.reader.read(await this.defined.ofTeam(teamId));
  }
}
