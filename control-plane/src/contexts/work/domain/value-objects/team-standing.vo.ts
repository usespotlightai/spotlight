import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';

type TeamReach = 'outside' | 'workspace' | 'actor' | 'member';

export class TeamStanding {
  private constructor(private readonly reach: TeamReach) {}

  static of(input: {
    readonly seesTeam: boolean;
    readonly actsOnTeam: boolean;
    readonly memberOfTeam: boolean;
  }): TeamStanding {
    if (input.memberOfTeam && !input.actsOnTeam) {
      throw new InconsistentStateError(
        'team standing',
        'makes a member of the team unable to act on its tasks.',
      );
    }

    if (input.actsOnTeam) {
      return new TeamStanding(input.memberOfTeam ? 'member' : 'actor');
    }

    return new TeamStanding(input.seesTeam ? 'workspace' : 'outside');
  }

  static outside(): TeamStanding {
    return new TeamStanding('outside');
  }

  get seesTasks(): boolean {
    return this.reach !== 'outside';
  }

  get actsOnTasks(): boolean {
    return this.reach === 'actor' || this.reach === 'member';
  }

  get takesTasks(): boolean {
    return this.reach === 'member';
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
