import type { TeamSkillKeysPort } from '@configuration/application/ports/team-skill-keys.port';
import type { DefinedSkillsPort } from '@insights/application/ports/defined-skills.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DefinedSkills implements DefinedSkillsPort {
  constructor(private readonly skills: TeamSkillKeysPort) {}

  keysOf(teamId: string): Promise<readonly string[]> {
    return this.skills.definedFor(TeamId.of(teamId));
  }
}
