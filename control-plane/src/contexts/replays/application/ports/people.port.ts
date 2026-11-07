import type { Membership } from '@replays/application/services/team-access';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const PEOPLE = Symbol('REPLAYS_PEOPLE');

export interface PeoplePort {
  membershipOn(
    teamId: TeamId,
    principal: Principal,
  ): Promise<Membership | null>;

  teamKey(teamId: TeamId): Promise<string | null>;
}
