import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';

export class TeamStanding {
  private constructor(private readonly readsTeam: boolean) {}

  static of(input: { readonly readsTeam: boolean }): TeamStanding {
    return new TeamStanding(input.readsTeam);
  }

  actingOn<T>(seen: T | null, unseen: () => Error): T {
    if (seen === null) {
      throw unseen();
    }

    if (!this.readsTeam) {
      throw new TeamMembershipRequiredError();
    }

    return seen;
  }

  equals(other: TeamStanding): boolean {
    return this.readsTeam === other.readsTeam;
  }
}
