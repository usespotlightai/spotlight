import type { PeoplePort } from '@outcomes/application/ports/people.port';
import { TeamAccess } from '@outcomes/domain/services/team-access';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class OutcomesAccess {
  constructor(private readonly people: PeoplePort) {}

  async forTeam(teamId: string, viewerId: string): Promise<TeamAccess> {
    return TeamAccess.onTeam(
      teamId,
      await this.people.membershipOnTeam(
        teamId,
        PersonPrincipal.of(UserId.of(viewerId)),
      ),
    );
  }

  async accessFor(teamId: string, principal: Principal): Promise<TeamAccess> {
    return TeamAccess.onTeam(
      teamId,
      await this.people.membershipOnTeam(teamId, principal),
    );
  }
}
