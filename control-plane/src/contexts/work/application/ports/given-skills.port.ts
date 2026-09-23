import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const GIVEN_SKILLS = Symbol('GIVEN_SKILLS');

export interface GivenSkill {
  readonly skill: string;
  readonly line: string;
  readonly station: string;
}

export interface GivenSkillsPort {
  onTeam(teamId: TeamId): Promise<readonly GivenSkill[]>;
}
