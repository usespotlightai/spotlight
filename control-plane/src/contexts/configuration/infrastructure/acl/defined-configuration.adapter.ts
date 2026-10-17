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
        source: each.source,
        name: each.name,
        path: each.path,
        connectable: each.connects,
        holder: each.holder,
        linked: each.linked,
        handle: each.handle,
        described: each.described,
      })),
    };
  }
}
