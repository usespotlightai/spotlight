import type {
  ConfigurationReaderPort,
  ConfigurationView,
} from '@configuration/application/ports/configuration-reader.port';
import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DefinedConfiguration implements ConfigurationReaderPort {
  constructor(private readonly reader: IntegrationReaderPort) {}

  async of(teamId: TeamId): Promise<ConfigurationView> {
    const { integrations } = await this.reader.ofTeam(teamId);

    return {
      integrations: integrations.map((each) => ({
        integration: each.integration,
        name: each.name,
        path: each.path,
        requiresConnection: each.requiresConnection,
        actsAs: each.actsAs,
        connected: each.connected,
        linkedAccount: each.linkedAccount,
        spec: each.spec,
      })),
    };
  }
}
