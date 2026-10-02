import { TaskDeliveryClosed } from '@outcomes/domain/events/task-delivery-closed.event';
import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestReview {
  readonly pullRequest: PullRequestUrl;
  readonly at: Date | null;
  readonly byBot: boolean;
}

export type CountedReview = PullRequestReview & { readonly at: Date };

export const countsAsReview = (
  review: PullRequestReview,
): review is CountedReview => !review.byBot && review.at !== null;

export class TaskDelivery extends EventRecorder {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly pullRequest: PullRequestUrl,
    readonly state: DeliveryState,
    readonly openedAt: Date,
    readonly firstReviewAt: Date | null,
    readonly closedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static opened(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    pullRequest: PullRequestUrl;
    at: Date;
  }): TaskDelivery {
    return new TaskDelivery(
      input.taskId,
      input.workspaceId,
      input.teamId,
      input.pullRequest,
      'open',
      input.at,
      null,
      null,
      0,
    );
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    pullRequest: PullRequestUrl;
    state: DeliveryState;
    openedAt: Date;
    firstReviewAt: Date | null;
    closedAt: Date | null;
    version: number;
  }): TaskDelivery {
    return new TaskDelivery(
      input.taskId,
      input.workspaceId,
      input.teamId,
      input.pullRequest,
      input.state,
      input.openedAt,
      input.firstReviewAt,
      input.closedAt,
      input.version,
    );
  }

  asOf(at: Date): TaskDelivery | null {
    const known = (when: Date | null): boolean =>
      when !== null && when.getTime() <= at.getTime();

    if (!known(this.openedAt)) {
      return null;
    }

    const closed = this.finished && known(this.closedAt);

    return new TaskDelivery(
      this.taskId,
      this.workspaceId,
      this.teamId,
      this.pullRequest,
      closed ? this.state : 'open',
      this.openedAt,
      known(this.firstReviewAt) ? this.firstReviewAt : null,
      closed ? this.closedAt : null,
      this.version,
    );
  }

  get merged(): boolean {
    return this.state === 'merged';
  }

  get finished(): boolean {
    return this.state !== 'open';
  }

  reopenedAs(pullRequest: PullRequestUrl, at: Date): TaskDelivery {
    if (pullRequest.equals(this.pullRequest)) {
      return this;
    }

    return this.with(
      new TaskDelivery(
        this.taskId,
        this.workspaceId,
        this.teamId,
        pullRequest,
        'open',
        at,
        null,
        null,
        this.version,
      ),
    );
  }

  reviewed(review: PullRequestReview): TaskDelivery {
    if (
      !countsAsReview(review) ||
      !review.pullRequest.equals(this.pullRequest) ||
      (this.firstReviewAt !== null &&
        this.firstReviewAt.getTime() <= review.at.getTime())
    ) {
      return this;
    }

    return this.with(
      new TaskDelivery(
        this.taskId,
        this.workspaceId,
        this.teamId,
        this.pullRequest,
        this.state,
        this.openedAt,
        review.at,
        this.closedAt,
        this.version,
      ),
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

    const closed = this.with(
      new TaskDelivery(
        this.taskId,
        this.workspaceId,
        this.teamId,
        this.pullRequest,
        state,
        this.openedAt,
        this.firstReviewAt,
        input.at ?? this.closedAt,
        this.version,
      ),
    );

    closed.record(
      new TaskDeliveryClosed(
        this.taskId,
        this.workspaceId,
        this.teamId,
        closed.merged,
      ),
    );

    return closed;
  }

  private with(next: TaskDelivery): TaskDelivery {
    next.inheritEvents(this);

    return next;
  }
}
