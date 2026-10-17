import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillCompilerPort } from '@configuration/application/ports/skill-compiler.port';
import type { SkillRecord } from '@configuration/application/ports/skill-resources.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class SkillViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: SkillCompilerPort,
  ) {}

  async of(record: SkillRecord): Promise<SkillResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    return team ? this.onTeam(record, team.key) : null;
  }

  onTeam(record: SkillRecord, teamKey: string): SkillResourceDto {
    const read = this.compiler.compile({
      key: record.key,
      files: record.files,
    });

    return {
      id: record.id,
      version: record.version,
      address: TeamAddress.of(teamKey, record.key).toString(),
      teamId: record.teamId.value,
      key: record.key,
      files: record.files,
      description: read.ok ? read.skill.description : '',
      secrets: read.ok
        ? read.skill.secrets.map((each) => ({
            name: each.name.value,
            description: each.description,
          }))
        : [],
      tools: read.ok ? read.skill.tools.map((each) => each.value) : [],
      warnings: read.ok ? [] : read.problems,
    };
  }
}
