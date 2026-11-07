import type { TeamSkillKeysPort } from '@configuration/application/ports/team-skill-keys.port';
import type { ReadySkills } from '@configuration/application/services/ready-skills.service';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamSkillKeys implements TeamSkillKeysPort {
  constructor(private readonly skills: ReadySkills) {}

  async definedFor(teamId: TeamId): Promise<readonly string[]> {
    return (await this.skills.definedFor(teamId)).map((key) => key.value);
  }
}
