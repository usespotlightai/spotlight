import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillCompilerPort } from '@configuration/application/ports/skill-compiler.port';
import type { SkillRecord } from '@configuration/application/ports/skill-resources.port';
import { SkillProblems } from '@configuration/application/rendering/skill-problems';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import type { Skill } from '@configuration/domain/value-objects/skill.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
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
    const read = this.read(record);
    const skill = 'skill' in read ? read.skill : null;

    return {
      id: record.id,
      version: record.version,
      address: TeamAddress.of(teamKey, record.key).toString(),
      teamId: record.teamId.value,
      key: record.key,
      files: record.files,
      description: skill?.description ?? '',
      secrets:
        skill?.secrets.map((each) => ({
          name: each.name.value,
          description: each.description,
        })) ?? [],
      tools: skill?.tools.map((each) => each.value) ?? [],
      warnings: 'problems' in read ? read.problems : [],
    };
  }

  private read(
    record: SkillRecord,
  ):
    | { readonly skill: Skill }
    | { readonly problems: readonly ConfigurationProblem[] } {
    const compiled = this.compiler.compile({
      key: record.key,
      files: record.files,
    });

    if (!compiled.ok) {
      return { problems: compiled.problems };
    }

    try {
      return { skill: this.compiler.skillIn(compiled.key, compiled.files) };
    } catch (error) {
      if (error instanceof InvalidSkillError) {
        return { problems: [SkillProblems.invalid(record.key, error)] };
      }

      throw error;
    }
  }
}
