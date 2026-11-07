import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';

export const TEAM_SKILLS = Symbol('TEAM_SKILLS');

export interface TeamSkillsPort {
  readyFor(
    teamId: TeamId,
    named: readonly string[],
  ): Promise<readonly ReadySkillFolder[]>;
}
