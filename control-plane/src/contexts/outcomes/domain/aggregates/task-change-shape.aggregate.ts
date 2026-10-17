import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeShape {
  readonly changeTitles: readonly string[];
  readonly changeIntents: readonly string[];
  readonly at: Date;
}

export class TaskChangeShape {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly shape: ChangeShape,
    readonly version: number,
  ) {}

  static create(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    shape: ChangeShape;
  }): TaskChangeShape {
    return new TaskChangeShape(
      input.taskId,
      input.workspaceId,
      input.teamId,
      input.shape,
      0,
    );
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    shape: ChangeShape;
    version: number;
  }): TaskChangeShape {
    return new TaskChangeShape(
      input.taskId,
      input.workspaceId,
      input.teamId,
      input.shape,
      input.version,
    );
  }

  withShape(shape: ChangeShape): TaskChangeShape {
    if (shape.at.getTime() <= this.shape.at.getTime()) {
      return this;
    }

    return new TaskChangeShape(
      this.taskId,
      this.workspaceId,
      this.teamId,
      shape,
      this.version,
    );
  }
}
