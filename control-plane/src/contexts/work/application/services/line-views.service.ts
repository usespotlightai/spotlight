import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import type { KeptLine } from '@work/application/ports/line-resources.port';

export class LineViews {
  constructor(private readonly teams: TeamDirectoryPort) {}

  async of(kept: KeptLine): Promise<LineResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    return team ? this.onTeam(kept, team.key) : null;
  }

  onTeam(kept: KeptLine, teamKey: string): LineResourceDto {
    return {
      id: kept.id,
      version: kept.version,
      address: TeamAddress.of(teamKey, kept.key).toString(),
      teamId: kept.teamId.value,
      key: kept.key,
      definition: kept.definition,
      warnings: [],
    };
  }
}
