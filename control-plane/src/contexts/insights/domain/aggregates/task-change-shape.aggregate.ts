import { TaskChangeShapeErased } from '@insights/domain/events/task-change-shape-erased.event';
import { TaskChangeShaped } from '@insights/domain/events/task-change-shaped.event';
import {
  keepsOneStackEach,
  type RepositoryStack,
  withLatestStack,
} from '@insights/domain/services/repository-stacks';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { sameRepositoryName } from '@shared-kernel/domain/services/repository-names';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeShape {
  readonly changeTitles: readonly string[];
  readonly changeIntents: readonly string[];
}

export interface RepositoryShape extends ChangeShape, RepositoryStack {
  readonly at: Date;
}

const checked = (shape: RepositoryShape): RepositoryShape => {
  if (shape.changeTitles.length !== shape.changeIntents.length) {
    throw new InconsistentStateError(
      'change shape',
      'needs one intent for each change title',
    );
  }
  if (
    Number.isNaN(shape.stackStartedAt.getTime()) ||
    Number.isNaN(shape.at.getTime())
  ) {
    throw new InconsistentStateError(
      'change shape',
      'needs the time its stack started and was shaped',
    );
  }

  return shape;
};

const checkedAll = (
  shapes: readonly RepositoryShape[],
): readonly RepositoryShape[] => {
  if (!keepsOneStackEach(shapes)) {
    throw new InconsistentStateError(
      'change shape',
      'keeps one shape for each repository',
    );
  }

  return shapes.map(checked);
};

const breaksTie = (shape: RepositoryShape, kept: RepositoryShape): boolean =>
  shape.at.getTime() > kept.at.getTime();

export class TaskChangeShape extends EventRecorder {
  private deleted = false;

  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly shapes: readonly RepositoryShape[],
    readonly version: number,
  ) {
    super();
  }

  static create(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    shape: RepositoryShape;
  }): TaskChangeShape {
    const created = new TaskChangeShape(
      input.taskId,
      input.workspaceId,
      input.teamId,
      [checked(input.shape)],
      0,
    );

    created.record(new TaskChangeShaped(input.taskId, input.workspaceId));

    return created;
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    shapes: readonly RepositoryShape[];
    version: number;
  }): TaskChangeShape {
    return new TaskChangeShape(
      input.taskId,
      input.workspaceId,
      input.teamId,
      checkedAll(input.shapes),
      input.version,
    );
  }

  withShape(shape: RepositoryShape): TaskChangeShape {
    const shapes = withLatestStack(this.shapes, checked(shape), breaksTie);

    if (shapes === this.shapes) {
      return this;
    }

    const reshaped = new TaskChangeShape(
      this.taskId,
      this.workspaceId,
      this.teamId,
      shapes,
      this.version,
    );

    reshaped.inheritEvents(this);
    reshaped.record(new TaskChangeShaped(this.taskId, this.workspaceId));

    return reshaped;
  }

  shapeOf(pullRequest: PullRequestUrl): ChangeShape | null {
    const name = pullRequest.repository?.name ?? null;

    return (
      this.shapes.find(
        (each) => name !== null && sameRepositoryName(each.repository, name),
      ) ??
      this.shapes.find((each) => each.repository === null) ??
      null
    );
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): TaskChangeShape {
    const deleted = new TaskChangeShape(
      this.taskId,
      this.workspaceId,
      this.teamId,
      this.shapes,
      this.version,
    );

    deleted.inheritEvents(this);
    deleted.deleted = true;
    deleted.record(new TaskChangeShapeErased(this.taskId, this.workspaceId));

    return deleted;
  }
}
