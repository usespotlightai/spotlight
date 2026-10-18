import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { TeamNotFoundError } from '@memory/domain/exceptions/team-not-found.error';
import type { RunContext } from '@memory/domain/value-objects/run-context';
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
      throw new TeamNotFoundError(teamId);
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

  sees(runContext: RunContext): boolean {
    return runContext.teamId.equals(this.teamId);
  }
}
