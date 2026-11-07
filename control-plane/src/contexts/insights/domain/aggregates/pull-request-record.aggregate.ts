import { PullRequestOwned } from '@insights/domain/events/pull-request-owned.event';
import { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import { PullRequestRecordErased } from '@insights/domain/events/pull-request-record-erased.event';
import { PullRequestReleased } from '@insights/domain/events/pull-request-released.event';
import { PullRequestReviewTaskAdded } from '@insights/domain/events/pull-request-review-task-added.event';
import { PullRequestSeen } from '@insights/domain/events/pull-request-seen.event';
import { InvalidPullRequestRecordError } from '@insights/domain/exceptions/invalid-pull-request-record.error';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { PullRequestState } from '@insights/domain/value-objects/pull-request-state';
import type { TaskPullRequestFact } from '@insights/domain/value-objects/run-fact.vo';
import {
  SeenPullRequest,
  type SeenPullRequestFields,
} from '@insights/domain/value-objects/seen-pull-request.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestOwner {
  readonly taskId: TaskId;
  readonly teamId: TeamId;
  readonly openedAt: Date;
}

const assertConsistent = (record: PullRequestRecord): PullRequestRecord => {
  if (record.removable) {
    throw new InvalidPullRequestRecordError(
      'must hold what GitHub said, a task, or a tombstone',
    );
  }
  if (record.isTombstone && record.seen !== null) {
    throw new InvalidPullRequestRecordError(
      'as a tombstone must not keep what GitHub said',
    );
  }

  return record;
};

const finished = (state: PullRequestState): boolean => state !== 'open';

export class PullRequestRecord extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly seen: SeenPullRequest | null,
    readonly owner: PullRequestOwner | null,
    readonly reviewTasks: readonly TaskId[],
    readonly githubPurgedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static noted(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): PullRequestRecord {
    return new PullRequestRecord(
      workspaceId,
      pullRequest,
      null,
      null,
      [],
      null,
      0,
    );
  }

  static latestOwnedOf(
    records: readonly PullRequestRecord[],
  ): TaskPullRequestFact | null {
    const [latest] = records
      .flatMap((each) => {
        const owned = each.forTask;
        return owned ? [owned] : [];
      })
      .sort(
        (one, other) =>
          other.openedAt.getTime() - one.openedAt.getTime() ||
          other.pullRequest.value.localeCompare(one.pullRequest.value),
      );

    return latest ?? null;
  }

  static rehydrate(input: {
    workspaceId: WorkspaceId;
    pullRequest: PullRequestUrl;
    seen: SeenPullRequest | null;
    owner: PullRequestOwner | null;
    reviewTasks: readonly TaskId[];
    githubPurgedAt: Date | null;
    version: number;
  }): PullRequestRecord {
    return assertConsistent(
      new PullRequestRecord(
        input.workspaceId,
        input.pullRequest,
        input.seen,
        input.owner,
        input.reviewTasks,
        input.githubPurgedAt,
        input.version,
      ),
    );
  }

  get outlivesGitHub(): boolean {
    return this.owner !== null || this.reviewTasks.length > 0;
  }

  get isTombstone(): boolean {
    return this.githubPurgedAt !== null && !this.outlivesGitHub;
  }

  get removable(): boolean {
    return (
      this.seen === null && this.githubPurgedAt === null && !this.outlivesGitHub
    );
  }

  get state(): PullRequestState {
    return this.seen?.state ?? 'open';
  }

  get forTask(): TaskPullRequestFact | null {
    return this.owner
      ? {
          workspaceId: this.workspaceId,
          taskId: this.owner.taskId,
          teamId: this.owner.teamId,
          pullRequest: this.pullRequest,
          state: this.state,
          openedAt: this.owner.openedAt,
          firstReviewAt: this.seen?.firstReviewAt ?? null,
          closedAt: this.seen?.closedAt ?? null,
        }
      : null;
  }

  tombstoneExpiredBefore(before: Date): boolean {
    return (
      this.isTombstone &&
      (this.githubPurgedAt?.getTime() ?? 0) < before.getTime()
    );
  }

  seenAs(fields: SeenPullRequestFields): PullRequestRecord {
    const seen = SeenPullRequest.of(fields);

    if (this.githubPurgedAt) {
      return seen.updatedAt.getTime() > this.githubPurgedAt.getTime()
        ? this.seenNow(seen, null)
        : this;
    }

    if (this.seen && seen.version <= this.seen.version) {
      return this;
    }

    return this.seenNow(seen, this.githubPurgedAt);
  }

  assignOwner(owner: PullRequestOwner): PullRequestRecord {
    if (
      this.owner?.taskId.equals(owner.taskId) &&
      this.owner.teamId.equals(owner.teamId)
    ) {
      return this;
    }

    const owned = this.with({ owner });

    owned.record(
      new PullRequestOwned(
        this.workspaceId,
        this.pullRequest,
        owner.taskId,
        owner.teamId,
        this.owner?.taskId ?? null,
      ),
    );

    return finished(owned.state) ? owned.closedFor(owner) : owned;
  }

  recordReview(taskId: TaskId): PullRequestRecord {
    if (this.reviewTasks.some((each) => each.equals(taskId))) {
      return this;
    }

    const reviewed = this.with({ reviewTasks: [...this.reviewTasks, taskId] });

    reviewed.record(
      new PullRequestReviewTaskAdded(
        this.workspaceId,
        this.pullRequest,
        taskId,
      ),
    );

    return reviewed;
  }

  purgedByGitHub(updatedAt: Date): PullRequestRecord {
    if (
      this.seen &&
      !this.githubPurgedAt &&
      this.seen.updatedAt.getTime() > updatedAt.getTime()
    ) {
      return this;
    }

    if (
      this.githubPurgedAt &&
      this.githubPurgedAt.getTime() >= updatedAt.getTime()
    ) {
      return this;
    }

    const purged = this.with({ githubPurgedAt: updatedAt });

    if (purged.seen !== this.seen) {
      purged.record(
        new PullRequestSeen(
          this.workspaceId,
          this.pullRequest,
          this.owner?.taskId ?? null,
        ),
      );
    }

    return purged;
  }

  erasing(scope: DeletionScope): PullRequestRecord | null {
    switch (scope.kind) {
      case 'task':
        return this.withoutTask(scope.taskId);
      case 'team':
        return this.withoutTeam(scope.teamId);
      case 'workspace':
        return null;
    }
  }

  erased(): PullRequestRecord {
    const erased = this.with({});

    erased.record(
      new PullRequestRecordErased(
        this.workspaceId,
        this.pullRequest,
        this.owner?.taskId ?? null,
      ),
    );

    return erased;
  }

  private withoutTask(taskId: TaskId): PullRequestRecord | null {
    const owned = this.owner?.taskId.equals(taskId) ?? false;
    const reviewed = this.reviewTasks.some((each) => each.equals(taskId));

    if (!owned && !reviewed) {
      return this;
    }

    return this.released(
      {
        owner: owned ? null : this.owner,
        reviewTasks: this.reviewTasks.filter((each) => !each.equals(taskId)),
      },
      [taskId],
    );
  }

  private withoutTeam(teamId: TeamId): PullRequestRecord | null {
    if (!this.owner?.teamId.equals(teamId)) {
      return this;
    }

    return this.released({ owner: null }, [this.owner.taskId]);
  }

  private released(
    change: {
      owner?: null | PullRequestOwner;
      reviewTasks?: readonly TaskId[];
    },
    taskIds: readonly TaskId[],
  ): PullRequestRecord | null {
    const released = this.with(change);

    if (released.removable) {
      return null;
    }

    released.record(
      new PullRequestReleased(this.workspaceId, this.pullRequest, taskIds),
    );

    return released;
  }

  private seenNow(
    seen: SeenPullRequest,
    githubPurgedAt: Date | null,
  ): PullRequestRecord {
    const before = this.state;
    const next = this.with({ seen, githubPurgedAt });

    next.record(
      new PullRequestSeen(
        this.workspaceId,
        this.pullRequest,
        this.owner?.taskId ?? null,
      ),
    );

    return this.owner && next.state !== before && finished(next.state)
      ? next.closedFor(this.owner)
      : next;
  }

  private closedFor(owner: PullRequestOwner): PullRequestRecord {
    this.record(
      new PullRequestRecordClosed(
        this.workspaceId,
        this.pullRequest,
        owner.taskId,
        owner.teamId,
        this.state === 'merged',
      ),
    );

    return this;
  }

  private with(
    change: Partial<{
      seen: SeenPullRequest | null;
      owner: PullRequestOwner | null;
      reviewTasks: readonly TaskId[];
      githubPurgedAt: Date | null;
    }>,
  ): PullRequestRecord {
    const owner = change.owner !== undefined ? change.owner : this.owner;
    const reviewTasks = change.reviewTasks ?? this.reviewTasks;
    const githubPurgedAt =
      change.githubPurgedAt !== undefined
        ? change.githubPurgedAt
        : this.githubPurgedAt;
    const tombstone =
      githubPurgedAt !== null && owner === null && reviewTasks.length === 0;
    const next = new PullRequestRecord(
      this.workspaceId,
      this.pullRequest,
      tombstone ? null : change.seen !== undefined ? change.seen : this.seen,
      owner,
      reviewTasks,
      githubPurgedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
