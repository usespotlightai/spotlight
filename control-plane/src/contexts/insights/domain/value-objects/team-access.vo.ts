import { TeamNotFoundError } from '@insights/domain/exceptions/team-not-found.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamViewer {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export class TeamAccess {
  private constructor(
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly by: UserId,
  ) {}

  static onTeam(teamId: TeamId, viewer: TeamViewer | null): TeamAccess {
    if (!viewer) {
      throw new TeamNotFoundError(teamId.value);
    }

    return new TeamAccess(teamId, viewer.workspaceId, viewer.by);
  }

  covers(workspaceId: WorkspaceId, teamId: TeamId): boolean {
    return this.workspaceId.equals(workspaceId) && this.teamId.equals(teamId);
  }
}
