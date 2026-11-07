import type { PeoplePort } from '@insights/application/ports/people.port';
import { TeamAccess } from '@insights/domain/value-objects/team-access.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class InsightsAccess {
  constructor(private readonly people: PeoplePort) {}

  forTeam(teamId: TeamId, viewerId: UserId): Promise<TeamAccess> {
    return this.accessFor(teamId, PersonPrincipal.of(viewerId));
  }

  async accessFor(teamId: TeamId, principal: Principal): Promise<TeamAccess> {
    return TeamAccess.onTeam(
      teamId,
      await this.people.viewerOf(teamId, principal),
    );
  }
}
