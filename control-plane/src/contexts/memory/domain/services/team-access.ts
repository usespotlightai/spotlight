import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { NotOnTeamError } from '@memory/domain/exceptions/not-on-team.error';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface Membership {
  readonly workspaceId: WorkspaceId;
  readonly by: UserId;
}

export interface TeamTask {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId | null;
}

export class TeamAccess {
  private constructor(
    readonly teamId: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly by: UserId,
  ) {}

  static onTeam(teamId: string, membership: Membership | null): TeamAccess {
    if (!membership) {
      throw new NotOnTeamError(teamId);
    }

    return new TeamAccess(
      TeamId.of(teamId),
      membership.workspaceId,
      membership.by,
    );
  }

  includes(memory: Memory): boolean {
    return (
      memory.scope.teamId.equals(this.teamId) &&
      memory.workspaceId.equals(this.workspaceId)
    );
  }

  reviews(task: TeamTask): boolean {
    return (
      task.workspaceId.equals(this.workspaceId) &&
      task.teamId?.equals(this.teamId) === true
    );
  }

  sees(site: RunSite): boolean {
    return site.teamId.equals(this.teamId);
  }
}
