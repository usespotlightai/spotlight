import { integrationFilesIn } from '@configuration/application/contracts/configuration-layout.contract';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';

export class TeamIntegrations implements TeamIntegrationsPort {
  constructor(
    private readonly applied: AppliedConfigurationPort,
    private readonly reader: IntegrationReaderPort,
  ) {}

  async offered(teamId: TeamId): Promise<readonly ToolDeclaration[]> {
    return (await this.read(teamId)).flatMap((each) => each.offers);
  }

  async listening(teamId: TeamId): Promise<readonly string[]> {
    return (await this.read(teamId)).map((each) => each.source);
  }

  private async read(teamId: TeamId) {
    const applied = await this.applied.of(teamId);

    return applied
      ? this.reader.read(integrationFilesIn(applied.files)).integrations
      : [];
  }
}
