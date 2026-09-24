import type {
  HeldIntegration,
  HeldIntegrationsPort,
} from '@configuration/application/ports/held-integrations.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  IntegrationResourcesPort,
  KeptIntegration,
} from '@integrations/application/ports/integration-resources.port';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { secretsWornBy } from '@integrations/infrastructure/integrations/worn-secrets';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const heldOn = (teamKey: string, kept: KeptIntegration): HeldIntegration => ({
  id: kept.id,
  address: IntegrationAddress.of(teamKey, SourceKey.of(kept.source)).toString(),
  teamId: kept.teamId,
  source: kept.source,
  definition: kept.definition,
  secretsWorn: secretsWornBy(kept.definition),
});

export class HeldIntegrations implements HeldIntegrationsPort {
  constructor(
    private readonly resources: IntegrationResourcesPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async withId(id: string): Promise<HeldIntegration | null> {
    const kept = await this.resources.withId(id);
    const team = kept && (await this.teams.find(kept.teamId));

    return kept && team ? heldOn(team.key, kept) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly HeldIntegration[]> {
    const team = await this.teams.find(teamId);

    return team
      ? (await this.resources.ofTeam(teamId)).map((each) =>
          heldOn(team.key, each),
        )
      : [];
  }
}
