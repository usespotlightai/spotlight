import type { TeamWindow } from '@insights/application/ports/insights-reader.port';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { TaskActions } from '@insights/domain/aggregates/task-actions.aggregate';
import { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import { TaskActionsVersionConflictError } from '@insights/domain/exceptions/task-actions-version-conflict.error';
import { TaskFailuresVersionConflictError } from '@insights/domain/exceptions/task-failures-version-conflict.error';
import type { TaskActionsRepository } from '@insights/domain/repositories/task-actions.repository';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import type { ActionKind } from '@insights/domain/value-objects/person-action.vo';
import { TaskAction } from '@insights/domain/value-objects/task-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { TEAM, WORKSPACE } from '@insights/runs.fake-spec';
import { inScope, removeVersioned } from '@insights/scoped.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TaskActionsInMemory implements TaskActionsRepository {
  readonly stored = new Map<string, TaskActions>();

  async add(taskActions: TaskActions): Promise<void> {
    if (this.stored.has(taskActions.taskId.value)) {
      throw new TaskActionsVersionConflictError(taskActions.taskId.value);
    }
    this.stored.set(taskActions.taskId.value, taskActions);
  }

  async save(taskActions: TaskActions): Promise<void> {
    if (taskActions.isDeleted) {
      return this.removed(taskActions);
    }

    const existing = this.stored.get(taskActions.taskId.value);

    if (!existing || existing.version !== taskActions.version) {
      throw new TaskActionsVersionConflictError(taskActions.taskId.value);
    }
    this.stored.set(
      taskActions.taskId.value,
      TaskActions.rehydrate({
        ...taskActions,
        version: taskActions.version + 1,
      }),
    );
  }

  async of(taskId: TaskId): Promise<TaskActions | null> {
    return this.stored.get(taskId.value) ?? null;
  }

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly TaskActions[]> {
    return taskIds.flatMap((each) => {
      const existing = this.stored.get(each.value);
      return existing ? [existing] : [];
    });
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly TaskActions[]> {
    return inScope(
      this.stored,
      scope,
      (each) => ({
        workspaceId: each.workspaceId,
        teamId: each.opening?.teamId ?? null,
        taskId: each.taskId,
      }),
      max,
    );
  }

  private async removed(removed: TaskActions): Promise<void> {
    removeVersioned(
      this.stored,
      removed.taskId.value,
      removed,
      () => new TaskActionsVersionConflictError(removed.taskId.value),
    );
  }
}

export class TaskFailuresInMemory implements TaskFailuresRepository {
  readonly stored = new Map<string, TaskFailures>();

  async add(failures: TaskFailures): Promise<void> {
    if (this.stored.has(failures.taskId.value)) {
      throw new TaskFailuresVersionConflictError(failures.taskId.value);
    }
    this.stored.set(failures.taskId.value, failures);
  }

  async save(failures: TaskFailures): Promise<void> {
    if (failures.isDeleted) {
      return this.removed(failures);
    }

    const existing = this.stored.get(failures.taskId.value);

    if (!existing || existing.version !== failures.version) {
      throw new TaskFailuresVersionConflictError(failures.taskId.value);
    }
    this.stored.set(
      failures.taskId.value,
      TaskFailures.rehydrate({ ...failures, version: failures.version + 1 }),
    );
  }

  async of(taskId: TaskId): Promise<TaskFailures | null> {
    return this.stored.get(taskId.value) ?? null;
  }

  async ofTeamBetween(
    window: TeamWindow,
    max: number,
  ): Promise<readonly TaskFailures[]> {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          each.teamId.equals(window.teamId) &&
          (each.lastAt?.getTime() ?? 0) >= window.from.getTime(),
      )
      .slice(0, max);
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly TaskFailures[]> {
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

  private async removed(removed: TaskFailures): Promise<void> {
    removeVersioned(
      this.stored,
      removed.taskId.value,
      removed,
      () => new TaskFailuresVersionConflictError(removed.taskId.value),
    );
  }
}

export const day = (date: string, hour = 12): Date =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);

export const taskActionsOf = (
  taskId: string,
  given: {
    openedBy?: string | null;
    openedAt?: Date;
    lineId?: string;
    asks?: readonly (readonly [string, Date])[];
    actions?: readonly (readonly [ActionKind, string, string, Date])[];
  } = {},
): TaskActions => {
  const opened = TaskActions.empty(TaskId.of(taskId), WORKSPACE).recordOpen(
    TaskOpening.of({
      teamId: TEAM,
      lineId: LineId.of(given.lineId ?? 'line_1'),
      stationId: StationId.of('station_0'),
      by:
        given.openedBy === null
          ? null
          : UserId.of(given.openedBy ?? 'user_ada'),
      at: given.openedAt ?? day('2026-09-28', 9),
    }),
  );
  const asked = (given.asks ?? []).reduce(
    (current, [stationId, at]) =>
      current.asked(InboxAsk.of(StationId.of(stationId), at)),
    opened,
  );

  return (given.actions ?? []).reduce(
    (current, [act, by, stationId, at]) =>
      current.recordAction(
        TaskAction.of({
          kind: act,
          by: UserId.of(by),
          stationId: StationId.of(stationId),
          at,
        }),
      ),
    asked,
  );
};

export const failuresOf = (
  taskId: string,
  raised: readonly {
    readonly stationId?: string;
    readonly source?: string;
    readonly code?: string;
    readonly occurrences?: number;
    readonly at: Date;
  }[],
): TaskFailures =>
  raised.reduce(
    (current, each) =>
      current.raise(
        FailureOccurrence.of({
          stationId: StationId.of(each.stationId ?? 'station_1'),
          runId: null,
          source: each.source ?? 'hook:notify',
          code: each.code ?? 'loop',
          occurrences: each.occurrences ?? 1,
          at: each.at,
        }),
      ),
    TaskFailures.empty(TaskId.of(taskId), WORKSPACE, TEAM),
  );

export const ownedRecordOf = (
  taskId: string,
  moments: {
    openedAt: Date;
    reviewedAt?: Date;
    closedAt?: Date;
    merged?: boolean;
  },
): PullRequestRecord => {
  const number =
    Array.from(taskId).reduce(
      (sum, each, at) => sum + each.charCodeAt(0) * (at + 1),
      0,
    ) + 1;
  const state = moments.closedAt
    ? (moments.merged ?? true)
      ? 'merged'
      : 'closed'
    : 'open';

  return PullRequestRecord.noted(
    WORKSPACE,
    PullRequestUrl.of(`https://github.com/acme/api/pull/${number}`),
  )
    .seenAs({
      repository: 'acme/api',
      number,
      title: 'Change',
      author: null,
      authorIsBot: false,
      branch: null,
      additions: null,
      deletions: null,
      changedFiles: null,
      openedAt: moments.openedAt,
      state,
      closedAt: moments.closedAt ?? null,
      updatedAt: moments.closedAt ?? moments.openedAt,
      readyForReviewAt: null,
      draftPeriods: [],
      firstReviewAt: moments.reviewedAt ?? null,
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
    })
    .assignOwner({
      taskId: TaskId.of(taskId),
      teamId: TEAM,
      openedAt: moments.openedAt,
    });
};
