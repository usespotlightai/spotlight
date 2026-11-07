import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import { ReadySkillMapper } from '@configuration/infrastructure/acl/ready-skill.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';

export class TeamSkills implements TeamSkillsPort {
  constructor(
    private readonly skills: TeamSkillReading,
    private readonly secrets: SecretNamesPort,
  ) {}

  async definedFor(teamId: TeamId): Promise<readonly string[]> {
    return (await this.skills.of(teamId)).map(
      (folder) => folder.skill.key.value,
    );
  }

  async readyFor(
    teamId: TeamId,
    named: readonly string[],
  ): Promise<readonly ReadySkillFolder[]> {
    if (named.length === 0) {
      return [];
    }

    const existing = await this.secrets.ofTeam(teamId);

    return (await this.skills.of(teamId))
      .filter(
        (folder) =>
          named.includes(folder.skill.key.value) &&
          folder.skill.isReadyWith(existing),
      )
      .map(ReadySkillMapper.toReady);
  }
}
