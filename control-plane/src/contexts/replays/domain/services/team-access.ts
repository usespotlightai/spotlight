import { TeamNotFoundError } from '@replays/domain/exceptions/team-not-found.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly mayPlan: boolean;
}

export interface Placed {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export class TeamAccess {
  private constructor(
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly mayPlan: boolean,
  ) {}

  static onTeam(teamId: string, membership: Membership | null): TeamAccess {
    if (!membership) {
      throw new TeamNotFoundError(teamId);
    }

    return new TeamAccess(
      TeamId.of(teamId),
      membership.workspaceId,
      membership.mayPlan,
    );
  }

  sees(placed: Placed): boolean {
    return (
      placed.teamId.equals(this.teamId) &&
      placed.workspaceId.equals(this.workspaceId)
    );
  }
}
