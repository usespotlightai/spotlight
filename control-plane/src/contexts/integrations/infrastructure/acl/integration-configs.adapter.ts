import type {
  IntegrationConfig,
  IntegrationConfigsPort,
} from '@configuration/application/ports/integration-configs.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  IntegrationRecord,
  IntegrationResourcesPort,
} from '@integrations/application/ports/integration-resources.port';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const configOf = (
  teamKey: string,
  record: IntegrationRecord,
  reader: IntegrationReader,
): IntegrationConfig => ({
  id: record.id,
  address: IntegrationAddress.of(
    teamKey,
    IntegrationKey.rehydrate(record.integration),
  ).toString(),
  teamId: record.teamId,
  integration: record.integration,
  definition: record.definition,
  secretReferences: reader.secretReferencesOf(record),
});

export class IntegrationConfigs implements IntegrationConfigsPort {
  constructor(
    private readonly resources: IntegrationResourcesPort,
    private readonly teams: TeamDirectoryPort,
    private readonly reader: IntegrationReader,
  ) {}

  async withId(id: string): Promise<IntegrationConfig | null> {
    const record = await this.resources.withId(IntegrationDefinitionId.of(id));
    const team = record && (await this.teams.find(record.teamId));

    return record && team ? configOf(team.key, record, this.reader) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly IntegrationConfig[]> {
    const team = await this.teams.find(teamId);

    return team
      ? (await this.resources.ofTeam(teamId)).map((each) =>
          configOf(team.key, each, this.reader),
        )
      : [];
  }
}
