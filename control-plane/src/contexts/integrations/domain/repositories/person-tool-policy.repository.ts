import type { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PERSON_TOOL_POLICIES = Symbol('PERSON_TOOL_POLICIES');

export interface PersonToolPolicyRepository {
  of(
    teamId: TeamId,
    personId: UserId,
    source: SourceKey,
  ): Promise<PersonToolPolicy | null>;

  ofPerson(
    teamId: TeamId,
    personId: UserId,
  ): Promise<readonly PersonToolPolicy[]>;

  save(policy: PersonToolPolicy): Promise<void>;

  deleteForTeam(teamId: TeamId): Promise<void>;
}
