import { TaskPullRequestClosed } from '@insights/domain/events/task-pull-request-closed.event';
import type { TaskPullRequestState } from '@insights/domain/value-objects/task-pull-request-state';
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

export class TaskPullRequest extends EventRecorder {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly pullRequest: PullRequestUrl,
    readonly state: TaskPullRequestState,
    readonly openedAt: Date,
    readonly firstReviewAt: Date | null,
    readonly closedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static open(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    pullRequest: PullRequestUrl;
    at: Date;
  }): TaskPullRequest {
    return new TaskPullRequest(
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
    state: TaskPullRequestState;
    openedAt: Date;
    firstReviewAt: Date | null;
    closedAt: Date | null;
    version: number;
  }): TaskPullRequest {
    return new TaskPullRequest(
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

  asOf(at: Date): TaskPullRequest | null {
    const known = (when: Date | null): boolean =>
      when !== null && when.getTime() <= at.getTime();

    if (!known(this.openedAt)) {
      return null;
    }

    const closed = this.finished && known(this.closedAt);

    return new TaskPullRequest(
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

  reopen(pullRequest: PullRequestUrl, at: Date): TaskPullRequest {
    if (pullRequest.equals(this.pullRequest)) {
      return this;
    }

    return this.with(
      new TaskPullRequest(
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

  recordReview(review: PullRequestReview): TaskPullRequest {
    if (
      !countsAsReview(review) ||
      !review.pullRequest.equals(this.pullRequest) ||
      (this.firstReviewAt !== null &&
        this.firstReviewAt.getTime() <= review.at.getTime())
    ) {
      return this;
    }

    return this.with(
      new TaskPullRequest(
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

  close(input: {
    pullRequest: PullRequestUrl;
    merged: boolean;
    at: Date | null;
  }): TaskPullRequest {
    if (
      !input.pullRequest.equals(this.pullRequest) ||
      this.state === 'merged'
    ) {
      return this;
    }

    const state: TaskPullRequestState = input.merged ? 'merged' : 'closed';

    if (state === this.state) {
      return this;
    }

    const closed = this.with(
      new TaskPullRequest(
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
      new TaskPullRequestClosed(
        this.taskId,
        this.workspaceId,
        this.teamId,
        closed.merged,
      ),
    );

    return closed;
  }

  private with(next: TaskPullRequest): TaskPullRequest {
    next.inheritEvents(this);

    return next;
  }
}
