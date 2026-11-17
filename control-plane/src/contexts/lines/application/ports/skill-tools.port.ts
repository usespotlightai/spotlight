import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SKILL_TOOLS = Symbol('SKILL_TOOLS');

export interface SkillToolsPort {
  ofTeam(
    teamId: TeamId,
    skills: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
