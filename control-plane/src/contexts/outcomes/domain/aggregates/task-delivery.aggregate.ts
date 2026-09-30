import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TaskDelivery {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly state: DeliveryState,
    readonly closedAt: Date | null,
    readonly version: number,
  ) {}

  static opened(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    pullRequest: PullRequestUrl;
  }): TaskDelivery {
    return new TaskDelivery(
      input.taskId,
      input.workspaceId,
      input.pullRequest,
      'open',
      null,
      0,
    );
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    pullRequest: PullRequestUrl;
    state: DeliveryState;
    closedAt: Date | null;
    version: number;
  }): TaskDelivery {
    return new TaskDelivery(
      input.taskId,
      input.workspaceId,
      input.pullRequest,
      input.state,
      input.closedAt,
      input.version,
    );
  }

  reopenedAs(pullRequest: PullRequestUrl): TaskDelivery {
    if (pullRequest.equals(this.pullRequest)) {
      return this;
    }

    return new TaskDelivery(
      this.taskId,
      this.workspaceId,
      pullRequest,
      'open',
      null,
      this.version,
    );
  }

  closed(input: {
    pullRequest: PullRequestUrl;
    merged: boolean;
    at: Date | null;
  }): TaskDelivery {
    if (
      !input.pullRequest.equals(this.pullRequest) ||
      this.state === 'merged'
    ) {
      return this;
    }

    const state: DeliveryState = input.merged ? 'merged' : 'closed';

    if (state === this.state) {
      return this;
    }

    return new TaskDelivery(
      this.taskId,
      this.workspaceId,
      this.pullRequest,
      state,
      input.at ?? this.closedAt,
      this.version,
    );
  }
}
