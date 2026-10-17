import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { HarnessProfileRecord } from '@configuration/application/ports/harness-profile-resources.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class HarnessProfileViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: HarnessProfileCompilerPort,
  ) {}

  async of(
    record: HarnessProfileRecord,
  ): Promise<HarnessProfileResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    return team ? this.onTeam(record, team.key) : null;
  }

  onTeam(
    record: HarnessProfileRecord,
    teamKey: string,
  ): HarnessProfileResourceDto {
    const read = this.compiler.read(record.definition);

    if (!read.ok) {
      throw new InconsistentStateError(
        'harness profile',
        `is in a shape that no longer reads (${record.id})`,
      );
    }

    return {
      id: record.id,
      version: record.version,
      address: TeamAddress.of(teamKey, read.key.value).toString(),
      teamId: record.teamId.value,
      key: read.key.value,
      permissions: read.settings.permissions,
      mcpServers: HarnessProfileMapper.servers(read.settings),
      native: read.settings.native,
      secretReferences: read.settings.secretReferences.map(
        ({ path, name }) => ({
          path: FieldPath.of(path.segments.slice(1)),
          name,
        }),
      ),
      warnings: this.compiler.warningsOf(read),
    };
  }
}
