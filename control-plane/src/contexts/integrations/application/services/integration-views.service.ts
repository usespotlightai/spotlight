import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import type { KeptIntegration } from '@integrations/application/ports/integration-resources.port';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';

export class IntegrationViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: IntegrationCompilerPort,
  ) {}

  async of(kept: KeptIntegration): Promise<IntegrationResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    return team ? this.onTeam(kept, team.key) : null;
  }

  onTeam(kept: KeptIntegration, teamKey: string): IntegrationResourceDto {
    const compiled = this.compiler.compile(kept.definition);

    return {
      id: kept.id,
      version: kept.version,
      address: IntegrationAddress.of(
        teamKey,
        SourceKey.of(kept.source),
      ).toString(),
      teamId: kept.teamId.value,
      source: kept.source,
      definition: kept.definition,
      warnings: compiled.ok ? compiled.warnings : compiled.problems,
    };
  }
}
