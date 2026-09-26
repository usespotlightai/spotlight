import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import type { KeptHook } from '@integrations/application/ports/hook-resources.port';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';

export class HookViews {
  constructor(private readonly teams: TeamDirectoryPort) {}

  async of(kept: KeptHook): Promise<HookResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    return team ? this.onTeam(kept, team.key) : null;
  }

  onTeam(kept: KeptHook, teamKey: string): HookResourceDto {
    return {
      id: kept.id,
      version: kept.version,
      address: HookAddress.of(teamKey, HookKey.of(kept.key)).toString(),
      teamId: kept.teamId.value,
      definition: kept.definition,
      warnings: [],
    };
  }
}
