import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import { PullRequestRecordVersionConflictError } from '@insights/domain/exceptions/pull-request-record-version-conflict.error';
import { TaskChangeShapeVersionConflictError } from '@insights/domain/exceptions/task-change-shape-version-conflict.error';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import {
  type ObservedPullRequest,
  SeenPullRequest,
  type SeenPullRequestFields,
} from '@insights/domain/value-objects/seen-pull-request.vo';
import { inScope, removeVersioned } from '@insights/scoped.fake-spec';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const seenOf = (
  over: Partial<SeenPullRequestFields> = {},
): SeenPullRequest =>
  SeenPullRequest.of({
    repository: 'acme/api',
    number: 7,
    title: 'Retry failed uploads',
    author: 'ada',
    authorIsBot: false,
    branch: null,
    additions: 40,
    deletions: 3,
    changedFiles: 2,
    openedAt: new Date('2026-09-28T08:00:00.000Z'),
    state: 'open',
    closedAt: null,
    updatedAt: new Date('2026-09-28T09:00:00.000Z'),
    readyForReviewAt: new Date('2026-09-28T08:00:00.000Z'),
    draftPeriods: [],
    firstReviewAt: null,
    firstUnblockingReviewAt: null,
    firstApprovedAt: null,
    humanReviewedAt: [],
    reviews: 0,
    reviewRounds: 0,
    reviewComments: 0,
    botActivity: [],
    isRevert: false,
    revertedBy: null,
    version: 1,
    ...over,
  });

export const observedOf = (
  over: Partial<ObservedPullRequest> = {},
): ObservedPullRequest => {
  const {
    firstReviewAt,
    firstUnblockingReviewAt,
    firstApprovedAt,
    humanReviewedAt,
    reviews,
    reviewRounds,
    reviewComments,
    botActivity,
    ...facts
  } = seenOf();

  return {
    ...facts,
    reviews: [],
    reviewComments,
    botComments: [],
    threads: [],
    ...over,
  };
};

const keyOf = (workspaceId: WorkspaceId, pullRequest: PullRequestUrl) =>
  `${workspaceId.value} ${pullRequest.value}`;

export class PullRequestRecordsInMemory implements PullRequestRecordRepository {
  readonly stored = new Map<string, PullRequestRecord>();

  async at(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestRecord | null> {
    return this.stored.get(keyOf(workspaceId, pullRequest)) ?? null;
  }

  async ownedBy(
    taskIds: readonly TaskId[],
  ): Promise<readonly PullRequestRecord[]> {
    return [...this.stored.values()].filter((each) =>
      taskIds.some((taskId) => each.owner?.taskId.equals(taskId)),
    );
  }

  async add(record: PullRequestRecord): Promise<void> {
    const key = keyOf(record.workspaceId, record.pullRequest);

    if (this.stored.has(key)) {
      throw new PullRequestRecordVersionConflictError(record.pullRequest.value);
    }
    this.stored.set(key, record);
  }

  async save(record: PullRequestRecord): Promise<void> {
    if (record.isDeleted) {
      return this.removed(record);
    }

    const key = keyOf(record.workspaceId, record.pullRequest);
    const existing = this.stored.get(key);

    if (!existing || existing.version !== record.version) {
      throw new PullRequestRecordVersionConflictError(record.pullRequest.value);
    }
    this.stored.set(
      key,
      PullRequestRecord.rehydrate({ ...record, version: record.version + 1 }),
    );
  }

  private async removed(record: PullRequestRecord): Promise<void> {
    const key = keyOf(record.workspaceId, record.pullRequest);

    if (this.stored.get(key)?.version !== record.version) {
      throw new PullRequestRecordVersionConflictError(record.pullRequest.value);
    }
    this.stored.delete(key);
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly PullRequestRecord[]> {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(scope.workspaceId) &&
          (scope.kind === 'workspace' ||
            (scope.kind === 'team' &&
              ((each.owner?.teamId.equals(scope.teamId) ?? false) ||
                each.reviewTasks.some((task) =>
                  task.teamId.equals(scope.teamId),
                ))) ||
            (scope.kind === 'task' &&
              ((each.owner?.taskId.equals(scope.taskId) ?? false) ||
                each.reviewTasks.some((task) =>
                  task.taskId.equals(scope.taskId),
                )))),
      )
      .slice(0, max);
  }

  async tombstonesBefore(
    before: Date,
    max: number,
  ): Promise<readonly PullRequestRecord[]> {
    return [...this.stored.values()]
      .filter((each) => each.tombstoneExpiredBefore(before))
      .slice(0, max);
  }
}

export class TaskChangeShapesInMemory implements TaskChangeShapeRepository {
  readonly stored = new Map<string, TaskChangeShape>();

  async forTask(taskId: TaskId): Promise<TaskChangeShape | null> {
    return this.stored.get(taskId.value) ?? null;
  }

  async forTasks(
    taskIds: readonly TaskId[],
  ): Promise<readonly TaskChangeShape[]> {
    return taskIds.flatMap((each) => {
      const existing = this.stored.get(each.value);
      return existing ? [existing] : [];
    });
  }

  async add(shape: TaskChangeShape): Promise<void> {
    if (this.stored.has(shape.taskId.value)) {
      throw new TaskChangeShapeVersionConflictError(shape.taskId.value);
    }
    this.stored.set(shape.taskId.value, shape);
  }

  async save(shape: TaskChangeShape): Promise<void> {
    if (shape.isDeleted) {
      return this.removed(shape);
    }

    const existing = this.stored.get(shape.taskId.value);

    if (!existing || existing.version !== shape.version) {
      throw new TaskChangeShapeVersionConflictError(shape.taskId.value);
    }
    this.stored.set(
      shape.taskId.value,
      TaskChangeShape.rehydrate({ ...shape, version: shape.version + 1 }),
    );
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly TaskChangeShape[]> {
    return inScope(
      this.stored,
      scope,
      (each) => ({
        workspaceId: each.workspaceId,
        teamId: each.teamId,
        taskId: each.taskId,
      }),
      max,
    );
  }

  private async removed(removed: TaskChangeShape): Promise<void> {
    removeVersioned(
      this.stored,
      removed.taskId.value,
      removed,
      () => new TaskChangeShapeVersionConflictError(removed.taskId.value),
    );
  }
}
