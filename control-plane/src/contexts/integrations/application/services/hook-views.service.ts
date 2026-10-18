import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import type { HookRecord } from '@integrations/application/ports/hook-resources.port';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';

export class HookViews {
  constructor(private readonly teams: TeamDirectoryPort) {}

  async of(record: HookRecord): Promise<HookResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    return team ? this.onTeam(record, team.key) : null;
  }

  onTeam(record: HookRecord, teamKey: string): HookResourceDto {
    return {
      id: record.id,
      version: record.version,
      address: HookAddress.of(teamKey, HookKey.of(record.key)).toString(),
      teamId: record.teamId.value,
      definition: record.definition,
      warnings: [],
    };
  }
}
