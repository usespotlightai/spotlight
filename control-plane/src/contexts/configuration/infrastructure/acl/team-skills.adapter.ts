import type { ReadySkills } from '@configuration/application/services/ready-skills.service';
import { ReadySkillMapper } from '@configuration/infrastructure/acl/ready-skill.mapper';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';

export class TeamSkills implements TeamSkillsPort {
  constructor(private readonly skills: ReadySkills) {}

  async readyFor(
    teamId: TeamId,
    named: readonly string[],
  ): Promise<readonly ReadySkillFolder[]> {
    return (
      await this.skills.readyFor(
        teamId,
        named.map((each) => SkillKey.of(each)),
      )
    ).map((each) => ReadySkillMapper.toReady(each));
  }
}
