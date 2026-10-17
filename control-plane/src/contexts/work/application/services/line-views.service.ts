import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import type { LineRecord } from '@work/application/ports/line-resources.port';

export class LineViews {
  constructor(private readonly teams: TeamDirectoryPort) {}

  async of(record: LineRecord): Promise<LineResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    return team ? this.onTeam(record, team.key) : null;
  }

  onTeam(record: LineRecord, teamKey: string): LineResourceDto {
    return {
      id: record.id,
      version: record.version,
      address: TeamAddress.of(teamKey, record.key).toString(),
      teamId: record.teamId.value,
      key: record.key,
      definition: record.definition,
      warnings: [],
    };
  }
}
