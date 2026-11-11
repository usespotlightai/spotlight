import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class FactOwner {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId | null,
    readonly taskId: TaskId | null,
  ) {}

  static of(
    workspaceId: WorkspaceId,
    owners: { teamId?: TeamId | null; taskId?: TaskId | null } = {},
  ): FactOwner {
    return new FactOwner(
      workspaceId,
      owners.teamId ?? null,
      owners.taskId ?? null,
    );
  }

  withTeam(teamId: TeamId | null | undefined): FactOwner {
    return this.teamId || !teamId
      ? this
      : new FactOwner(this.workspaceId, teamId, this.taskId);
  }
}
