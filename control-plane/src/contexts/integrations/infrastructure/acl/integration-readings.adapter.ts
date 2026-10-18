import type {
  IntegrationReaderPort,
  ReadIntegrations,
} from '@configuration/application/ports/integration-reader.port';
import type { ConnectedIntegrationsPort } from '@integrations/application/ports/connected-integrations.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationReadings implements IntegrationReaderPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly connected: ConnectedIntegrationsPort,
    private readonly reader: IntegrationReader,
  ) {}

  async ofTeam(teamId: TeamId): Promise<ReadIntegrations> {
    const [definitions, connections] = await Promise.all([
      this.defined.ofTeam(teamId),
      this.connected.ofTeam(teamId),
    ]);
    const linkedAccounts = new Map(
      connections.map((each) => [each.integration, each.linkedAccount]),
    );
    const read = this.reader.read(definitions);

    return {
      integrations: read.integrations.map((each) => ({
        ...each,
        connected: linkedAccounts.has(each.integration),
        linkedAccount: linkedAccounts.get(each.integration) ?? null,
      })),
      problems: read.problems,
    };
  }
}
