import { TeamNotFoundError } from '@insights/domain/exceptions/team-not-found.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export class TeamAccess {
  private constructor(
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly by: UserId,
  ) {}

  static onTeam(teamId: string, membership: Membership | null): TeamAccess {
    if (!membership) {
      throw new TeamNotFoundError(teamId);
    }

    return new TeamAccess(
      TeamId.of(teamId),
      membership.workspaceId,
      membership.by,
    );
  }
}
