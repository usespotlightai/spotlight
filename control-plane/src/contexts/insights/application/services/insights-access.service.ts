import type { PeoplePort } from '@insights/application/ports/people.port';
import { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class InsightsAccess {
  constructor(private readonly people: PeoplePort) {}

  forTeam(teamId: TeamId, viewerId: UserId): Promise<ViewedTeam> {
    return this.accessFor(teamId, PersonPrincipal.of(viewerId));
  }

  async actingOn(teamId: TeamId, viewerId: UserId): Promise<ViewedTeam> {
    const principal = PersonPrincipal.of(viewerId);
    const viewer = await this.people.viewerOf(teamId, principal);

    return ViewedTeam.actingOn(
      teamId,
      viewer,
      viewer !== null && (await this.people.actsOnTeam(teamId, principal)),
    );
  }

  async accessFor(teamId: TeamId, principal: Principal): Promise<ViewedTeam> {
    return ViewedTeam.onTeam(
      teamId,
      await this.people.viewerOf(teamId, principal),
    );
  }
}
