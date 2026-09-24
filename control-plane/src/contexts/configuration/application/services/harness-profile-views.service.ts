import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { KeptProfile } from '@configuration/application/ports/harness-profile-resources.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class HarnessProfileViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: HarnessProfileCompilerPort,
  ) {}

  async of(kept: KeptProfile): Promise<HarnessProfileResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    if (!team) {
      return null;
    }

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
      address: TeamAddress.of(team.key, read.key.value).toString(),
      teamId: kept.teamId.value,
      key: read.key.value,
      permissions: read.settings.permissions,
      mcpServers: HarnessProfileMapper.servers(read.settings),
      native: read.settings.native,
      warnings: this.compiler.warningsOf(read),
    };
  }
}
