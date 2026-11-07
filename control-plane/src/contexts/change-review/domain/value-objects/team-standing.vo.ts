import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';

export class TeamStanding {
  private constructor(private readonly actsForTeam: boolean) {}

  static of(input: { readonly actsForTeam: boolean }): TeamStanding {
    return new TeamStanding(input.actsForTeam);
  }

  actingOn<T>(seen: T | null, unseen: () => Error): T {
    if (seen === null) {
      throw unseen();
    }

    if (!this.actsForTeam) {
      throw new TeamMembershipRequiredError();
    }

    return seen;
  }

  equals(other: TeamStanding): boolean {
    return this.actsForTeam === other.actsForTeam;
  }
}
