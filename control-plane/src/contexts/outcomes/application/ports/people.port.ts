import type { Membership } from '@outcomes/domain/services/team-access';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export const PEOPLE = Symbol('OUTCOMES_PEOPLE');

export interface PeoplePort {
  membershipOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<Membership | null>;

  namesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
