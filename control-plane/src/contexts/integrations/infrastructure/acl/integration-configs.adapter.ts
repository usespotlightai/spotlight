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
import { secretsWornBy } from '@integrations/infrastructure/integrations/worn-secrets';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const configOf = (
  teamKey: string,
  kept: IntegrationRecord,
): IntegrationConfig => ({
  id: kept.id,
  address: IntegrationAddress.of(teamKey, SourceKey.of(kept.source)).toString(),
  teamId: kept.teamId,
  source: kept.source,
  definition: kept.definition,
  secretsWorn: secretsWornBy(kept.definition),
});

export class IntegrationConfigs implements IntegrationConfigsPort {
  constructor(
    private readonly resources: IntegrationResourcesPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async withId(id: string): Promise<IntegrationConfig | null> {
    const kept = await this.resources.withId(id);
    const team = kept && (await this.teams.find(kept.teamId));

    return kept && team ? configOf(team.key, kept) : null;
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
