import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { KeptProfile } from '@configuration/application/ports/harness-profile-resources.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class HarnessProfileViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: HarnessProfileCompilerPort,
  ) {}

  async of(kept: KeptProfile): Promise<HarnessProfileResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    return team ? this.onTeam(kept, team.key) : null;
  }

  onTeam(kept: KeptProfile, teamKey: string): HarnessProfileResourceDto {
    const read = this.compiler.read(kept.definition);

    if (!read.ok) {
      throw new InconsistentStateError(
        'harness profile',
        `was kept in a shape that no longer reads (${kept.id})`,
      );
    }

    return {
      id: kept.id,
      version: kept.version,
      address: TeamAddress.of(teamKey, read.key.value).toString(),
      teamId: kept.teamId.value,
      key: read.key.value,
      permissions: read.settings.permissions,
      mcpServers: HarnessProfileMapper.servers(read.settings),
      native: read.settings.native,
      secretsWorn: read.settings.wornSecrets.map(({ at, secret }) => ({
        path: FieldPath.of(at.slice(1)),
        name: secret.value,
      })),
      warnings: this.compiler.warningsOf(read),
    };
  }
}
