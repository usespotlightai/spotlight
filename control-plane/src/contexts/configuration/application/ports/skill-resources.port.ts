import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
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
  withId(id: SkillDefinitionId): Promise<SkillRecord | null>;

  at(teamId: TeamId, key: DefinedSkillKey): Promise<SkillRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly SkillRecord[]>;
}
