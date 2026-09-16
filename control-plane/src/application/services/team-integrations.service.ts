import { integrationFilesIn } from '@application/contracts/configuration-layout.contract';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { DeclaredTool } from '@domain/entities/declared-tool.entity';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';

export class TeamIntegrations {
  constructor(
    private readonly factories: FactoryRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReaderPort,
  ) {}

  async offered(line: Line): Promise<readonly DeclaredTool[]> {
    const factory = await this.factories.find(line.factoryId);
    const applied = factory
      ? await this.configurations.findFor(factory.teamId)
      : null;

    return applied
      ? this.reader
          .read(integrationFilesIn(applied.files))
          .integrations.flatMap((each) => each.offers)
      : [];
  }
}
