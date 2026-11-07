import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import type { ReadSkillFolder } from '@configuration/application/ports/skill-folders.port';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ReadySkills {
  constructor(
    private readonly skills: TeamSkillReading,
    private readonly secrets: SecretNamesPort,
  ) {}

  async definedFor(teamId: TeamId): Promise<readonly SkillKey[]> {
    return (await this.skills.of(teamId)).map(
      (folder) => folder.skill.key.skill,
    );
  }

  async readyFor(
    teamId: TeamId,
    named: readonly SkillKey[],
  ): Promise<readonly ReadSkillFolder[]> {
    if (named.length === 0) {
      return [];
    }

    const existing = await this.secrets.ofTeam(teamId);

    return (await this.skills.of(teamId)).filter(
      (folder) =>
        named.some((each) => each.equals(folder.skill.key.skill)) &&
        folder.skill.isReadyWith(existing),
    );
  }
}
