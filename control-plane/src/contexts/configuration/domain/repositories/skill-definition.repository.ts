import type { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const SKILL_DEFINITIONS = Symbol('SKILL_DEFINITIONS');

export interface SkillDefinitionRepository {
  withId(id: SkillDefinitionId): Promise<SkillDefinition | null>;

  of(teamId: TeamId, key: SkillKey): Promise<SkillDefinition | null>;

  ofTeam(teamId: TeamId): Promise<readonly SkillDefinition[]>;

  save(definition: SkillDefinition): Promise<void>;
}
