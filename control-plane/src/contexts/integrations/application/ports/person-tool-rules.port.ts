import type { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PERSON_TOOL_RULES = Symbol('PERSON_TOOL_RULES');

export interface PersonToolRulesPort {
  ofPerson(
    teamId: TeamId,
    personId: UserId,
  ): Promise<ReadonlyMap<string, PersonToolRule>>;
}
