import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillCompilerPort } from '@configuration/application/ports/skill-compiler.port';
import type { KeptSkill } from '@configuration/application/ports/skill-resources.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class SkillViews {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: SkillCompilerPort,
  ) {}

  async of(kept: KeptSkill): Promise<SkillResourceDto | null> {
    const team = await this.teams.find(kept.teamId);

    if (!team) {
      return null;
    }

    const read = this.compiler.compile({ key: kept.key, files: kept.files });

    return {
      id: kept.id,
      version: kept.version,
      address: TeamAddress.of(team.key, kept.key).toString(),
      teamId: kept.teamId.value,
      key: kept.key,
      files: kept.files,
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
