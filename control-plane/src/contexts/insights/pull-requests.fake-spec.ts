import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import { PullRequestRecordVersionConflictError } from '@insights/domain/exceptions/pull-request-record-version-conflict.error';
import { TaskChangeShapeVersionConflictError } from '@insights/domain/exceptions/task-change-shape-version-conflict.error';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { TaskChangeShapeRepository } from '@insights/domain/repositories/task-change-shape.repository';
import { spendingOf } from '@insights/domain/services/measures';
import type { TeamPullRequest } from '@insights/domain/services/team-pull-requests';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';
import {
  SeenPullRequest,
  type SeenPullRequestFields,
} from '@insights/domain/value-objects/seen-pull-request.vo';
import { inScope, removeVersioned } from '@insights/scoped.fake-spec';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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

export const teamPullRequestOf = (
  number: number,
  over: Partial<Omit<TeamPullRequest, 'seen' | 'spending'>> & {
    readonly seen?: Partial<SeenPullRequestFields>;
    readonly spends?: readonly (Money | null)[];
  } = {},
): TeamPullRequest => ({
  pullRequest: `https://github.com/${over.seen?.repository ?? 'acme/api'}/pull/${number}`,
  by: 'people',
  taskId: null,
  reviewTaskIds: [],
  type: 'feature',
  ...over,
  seen: seenOf({ number, ...over.seen }),
  spending: spendingOf(over.spends ?? []),
});

const keyOf = (workspaceId: WorkspaceId, pullRequest: PullRequestUrl) =>
  `${workspaceId.value} ${pullRequest.value}`;

export interface TeamPullRequestWindow {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly repositories: readonly string[];
  readonly from: Date;
  readonly to: Date;
}

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

  async remove(record: PullRequestRecord): Promise<void> {
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
              (each.owner?.teamId.equals(scope.teamId) ?? false)) ||
            (scope.kind === 'task' &&
              ((each.owner?.taskId.equals(scope.taskId) ?? false) ||
                each.reviewTasks.some((task) => task.equals(scope.taskId))))),
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

  async remove(removed: TaskChangeShape): Promise<void> {
    removeVersioned(
      this.stored,
      removed.taskId.value,
      removed,
      () => new TaskChangeShapeVersionConflictError(removed.taskId.value),
    );
  }
}
