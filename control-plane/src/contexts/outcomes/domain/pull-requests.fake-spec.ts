import {
  PullRequestRecord,
  type SeenPullRequest,
} from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { TaskChangeShape } from '@outcomes/domain/aggregates/task-change-shape.aggregate';
import { PullRequestRecordVersionConflictError } from '@outcomes/domain/exceptions/pull-request-record-version-conflict.error';
import { TaskChangeShapeVersionConflictError } from '@outcomes/domain/exceptions/task-change-shape-version-conflict.error';
import type { PullRequestRecordRepository } from '@outcomes/domain/repositories/pull-request-record.repository';
import type { TaskChangeShapeRepository } from '@outcomes/domain/repositories/task-change-shape.repository';
import { spendingOf } from '@outcomes/domain/services/measures';
import type { TeamPullRequest } from '@outcomes/domain/services/team-pull-requests';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const seenOf = (
  over: Partial<SeenPullRequest> = {},
): SeenPullRequest => ({
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
    readonly seen?: Partial<SeenPullRequest>;
    readonly spends?: readonly (Spend | null)[];
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

  async seenForTeamBetween(
    window: TeamPullRequestWindow,
    max: number,
  ): Promise<readonly PullRequestRecord[]> {
    const repositories = window.repositories.map((each) => each.toLowerCase());

    return [...this.stored.values()]
      .filter((each) => {
        const seen = each.seen;

        return (
          seen !== null &&
          each.workspaceId.equals(window.workspaceId) &&
          (repositories.includes(seen.repository.toLowerCase()) ||
            (each.owner?.teamId.equals(window.teamId) ?? false)) &&
          seen.openedAt.getTime() < window.to.getTime() &&
          (seen.closedAt === null ||
            seen.closedAt.getTime() >= window.from.getTime())
        );
      })
      .slice(0, max);
  }

  async findByTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<readonly PullRequestRecord[]> {
    return [...this.stored.values()].filter(
      (each) =>
        each.workspaceId.equals(workspaceId) &&
        ((each.owner?.taskId.equals(taskId) ?? false) ||
          each.reviewTasks.some((task) => task.equals(taskId))),
    );
  }

  async ownedByTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly PullRequestRecord[]> {
    return [...this.stored.values()].filter(
      (each) =>
        each.workspaceId.equals(workspaceId) &&
        (each.owner?.teamId.equals(teamId) ?? false),
    );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const [key, each] of [...this.stored.entries()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(key);
      }
    }
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

  async removeForTask(taskId: TaskId): Promise<void> {
    this.stored.delete(taskId.value);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.stored.delete(each.taskId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(each.taskId.value);
      }
    }
  }
}
