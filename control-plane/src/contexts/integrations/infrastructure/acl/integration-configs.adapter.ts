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
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { secretReferencesIn } from '@integrations/infrastructure/integrations/secret-references';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const configOf = (
  teamKey: string,
  record: IntegrationRecord,
): IntegrationConfig => ({
  id: record.id,
  address: IntegrationAddress.of(
    teamKey,
    SourceKey.of(record.source),
  ).toString(),
  teamId: record.teamId,
  source: record.source,
  definition: record.definition,
  secretReferences: secretReferencesIn(record.definition),
});

export class IntegrationConfigs implements IntegrationConfigsPort {
  constructor(
    private readonly resources: IntegrationResourcesPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async withId(id: string): Promise<IntegrationConfig | null> {
    const record = await this.resources.withId(id);
    const team = record && (await this.teams.find(record.teamId));

    return record && team ? configOf(team.key, record) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly IntegrationConfig[]> {
    const team = await this.teams.find(teamId);

    return team
      ? (await this.resources.ofTeam(teamId)).map((each) =>
          configOf(team.key, each),
        )
      : [];
  }
}
