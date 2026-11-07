import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';

export class TeamStanding {
  private constructor(private readonly actsOnTeam: boolean) {}

  static of(input: { readonly actsOnTeam: boolean }): TeamStanding {
    return new TeamStanding(input.actsOnTeam);
  }

  actingOn<T>(seen: T | null, unseen: () => Error): T {
    if (seen === null) {
      throw unseen();
    }

    if (!this.actsOnTeam) {
      throw new TeamMembershipRequiredError();
    }

    return seen;
  }

  equals(other: TeamStanding): boolean {
    return this.actsOnTeam === other.actsOnTeam;
  }
}
