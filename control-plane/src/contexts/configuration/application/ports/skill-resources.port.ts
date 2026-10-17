import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SKILL_RESOURCES = Symbol('SKILL_RESOURCES');

export interface SkillRecord {
  readonly id: string;
  readonly version: number;
  readonly teamId: TeamId;
  readonly key: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface SkillResourcesPort {
  withId(id: string): Promise<SkillRecord | null>;

  at(teamId: TeamId, key: string): Promise<SkillRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly SkillRecord[]>;
}
