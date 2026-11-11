import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';

type TeamReach = 'outside' | 'workspace' | 'team';

export class TeamStanding {
  private constructor(private readonly reach: TeamReach) {}

  static of(input: {
    readonly seesTeam: boolean;
    readonly actsOnTeam: boolean;
  }): TeamStanding {
    if (input.actsOnTeam) {
      return new TeamStanding('team');
    }

    return new TeamStanding(input.seesTeam ? 'workspace' : 'outside');
  }

  get seesTasks(): boolean {
    return this.reach !== 'outside';
  }

  get actsOnTasks(): boolean {
    return this.reach === 'team';
  }

  assertActsOnTasks(unseen: () => Error): void {
    if (!this.seesTasks) {
      throw unseen();
    }

    if (!this.actsOnTasks) {
      throw new TeamMembershipRequiredError();
    }
  }

  equals(other: TeamStanding): boolean {
    return this.reach === other.reach;
  }
}
