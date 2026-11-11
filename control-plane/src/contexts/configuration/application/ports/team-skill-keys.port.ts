import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_SKILL_KEYS = Symbol('TEAM_SKILL_KEYS');

export interface TeamSkillKeysPort {
  definedFor(teamId: TeamId): Promise<readonly string[]>;
}
