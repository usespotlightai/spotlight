import { NotOnTeamError } from '@replays/domain/exceptions/not-on-team.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamStanding {
  readonly workspaceId: WorkspaceId;
  readonly mayPlan: boolean;
}

export interface Placed {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export class ReplaysClearance {
  private constructor(
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly mayPlan: boolean,
  ) {}

  static onTeam(
    teamId: string,
    standing: TeamStanding | null,
  ): ReplaysClearance {
    if (!standing) {
      throw new NotOnTeamError(teamId);
    }

    return new ReplaysClearance(
      TeamId.of(teamId),
      standing.workspaceId,
      standing.mayPlan,
    );
  }

  sees(placed: Placed): boolean {
    return (
      placed.teamId.equals(this.teamId) &&
      placed.workspaceId.equals(this.workspaceId)
    );
  }
}
