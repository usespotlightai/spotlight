import { TaskChangeShapeErased } from '@insights/domain/events/task-change-shape-erased.event';
import { TaskChangeShaped } from '@insights/domain/events/task-change-shaped.event';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeShape {
  readonly changeTitles: readonly string[];
  readonly changeIntents: readonly string[];
  readonly at: Date;
}

const checked = (shape: ChangeShape): ChangeShape => {
  if (shape.changeTitles.length !== shape.changeIntents.length) {
    throw new InconsistentStateError(
      'change shape',
      'needs one intent for each change title',
    );
  }

  return shape;
};

export class TaskChangeShape extends EventRecorder {
  private deleted = false;

  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly shape: ChangeShape,
    readonly version: number,
  ) {
    super();
  }

  static create(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    shape: ChangeShape;
  }): TaskChangeShape {
    const created = new TaskChangeShape(
      input.taskId,
      input.workspaceId,
      input.teamId,
      checked(input.shape),
      0,
    );

    created.record(new TaskChangeShaped(input.taskId, input.workspaceId));

    return created;
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
      checked(input.shape),
      input.version,
    );
  }

  withShape(shape: ChangeShape): TaskChangeShape {
    if (shape.at.getTime() <= this.shape.at.getTime()) {
      return this;
    }

    const reshaped = new TaskChangeShape(
      this.taskId,
      this.workspaceId,
      this.teamId,
      checked(shape),
      this.version,
    );

    reshaped.inheritEvents(this);
    reshaped.record(new TaskChangeShaped(this.taskId, this.workspaceId));

    return reshaped;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): TaskChangeShape {
    const deleted = new TaskChangeShape(
      this.taskId,
      this.workspaceId,
      this.teamId,
      this.shape,
      this.version,
    );

    deleted.inheritEvents(this);
    deleted.deleted = true;
    deleted.record(new TaskChangeShapeErased(this.taskId, this.workspaceId));

    return deleted;
  }
}
