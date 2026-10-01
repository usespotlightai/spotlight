import type { PeoplePort } from '@outcomes/application/ports/people.port';
import { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class OutcomesAccess {
  constructor(private readonly people: PeoplePort) {}

  async clearance(
    teamId: string,
    viewerId: string,
  ): Promise<OutcomesClearance> {
    return OutcomesClearance.onTeam(
      teamId,
      await this.people.clearedOnTeam(
        teamId,
        PersonPrincipal.of(UserId.of(viewerId)),
      ),
    );
  }

  async clearanceFor(
    teamId: string,
    principal: Principal,
  ): Promise<OutcomesClearance> {
    return OutcomesClearance.onTeam(
      teamId,
      await this.people.clearedOnTeam(teamId, principal),
    );
  }
}
