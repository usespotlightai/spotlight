import { ChatRecord } from '@insights/domain/aggregates/chat-record.aggregate';
import { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import { ChatRecordVersionConflictError } from '@insights/domain/exceptions/chat-record-version-conflict.error';
import { TaskFailuresVersionConflictError } from '@insights/domain/exceptions/task-failures-version-conflict.error';
import { TaskHumanActionsVersionConflictError } from '@insights/domain/exceptions/task-human-actions-version-conflict.error';
import type { ChatRecordRepository } from '@insights/domain/repositories/chat-record.repository';
import type { TeamWindow } from '@insights/domain/repositories/run-record.repository';
import type { TaskFailuresRepository } from '@insights/domain/repositories/task-failures.repository';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import {
  type RunRecordsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import type { TeamHistory } from '@insights/domain/services/team-history';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { HumanActionKind } from '@insights/domain/value-objects/human-action.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const inWindow = (window: TeamWindow, at: Date | null): boolean =>
  at !== null &&
  at.getTime() >= window.from.getTime() &&
  at.getTime() < window.to.getTime();

export class TaskHumanActionsInMemory implements TaskHumanActionsRepository {
  readonly stored = new Map<string, TaskHumanActions>();

  constructor(private readonly records?: RunRecordsInMemory) {}

  async add(humanActions: TaskHumanActions): Promise<void> {
    if (this.stored.has(humanActions.taskId.value)) {
      throw new TaskHumanActionsVersionConflictError(humanActions.taskId.value);
    }
    this.stored.set(humanActions.taskId.value, humanActions);
  }

  async save(humanActions: TaskHumanActions): Promise<void> {
    const existing = this.stored.get(humanActions.taskId.value);

    if (!existing || existing.version !== humanActions.version) {
      throw new TaskHumanActionsVersionConflictError(humanActions.taskId.value);
    }
    this.stored.set(
      humanActions.taskId.value,
      TaskHumanActions.rehydrate({
        ...humanActions,
        version: humanActions.version + 1,
      }),
    );
  }

  async of(taskId: TaskId): Promise<TaskHumanActions | null> {
    return this.stored.get(taskId.value) ?? null;
  }

  async forTasks(
    taskIds: readonly TaskId[],
  ): Promise<readonly TaskHumanActions[]> {
    return taskIds.flatMap((each) => {
      const existing = this.stored.get(each.value);
      return existing ? [existing] : [];
    });
  }

  async ofTeamBetween(
    window: TeamWindow,
    max: number,
  ): Promise<readonly TaskHumanActions[]> {
    const worked = new Set(
      (
        (await this.records?.endedForTeam(window, Number.MAX_SAFE_INTEGER)) ??
        []
      ).flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
    );

    return [...this.stored.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          (worked.has(each.taskId.value) ||
            (each.opening?.teamId.equals(window.teamId) &&
              (each.lastActionAt?.getTime() ?? 0) >= window.from.getTime() &&
              each.opening.at.getTime() < window.to.getTime())),
      )
      .slice(0, max);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    this.stored.delete(taskId.value);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.opening?.teamId.equals(teamId)
      ) {
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

export class TaskFailuresInMemory implements TaskFailuresRepository {
  readonly stored = new Map<string, TaskFailures>();

  async add(failures: TaskFailures): Promise<void> {
    if (this.stored.has(failures.taskId.value)) {
      throw new TaskFailuresVersionConflictError(failures.taskId.value);
    }
    this.stored.set(failures.taskId.value, failures);
  }

  async save(failures: TaskFailures): Promise<void> {
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

export class ChatRecordsInMemory implements ChatRecordRepository {
  readonly stored = new Map<string, ChatRecord>();

  async add(record: ChatRecord): Promise<void> {
    if (this.stored.has(record.chatId)) {
      throw new ChatRecordVersionConflictError(record.chatId);
    }
    this.stored.set(record.chatId, record);
  }

  async of(chatId: string): Promise<ChatRecord | null> {
    return this.stored.get(chatId) ?? null;
  }

  async ofTeamBetween(
    window: TeamWindow,
    max: number,
  ): Promise<readonly ChatRecord[]> {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          each.teamId.equals(window.teamId) &&
          inWindow(window, each.startedAt),
      )
      .slice(0, max);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.stored.delete(each.chatId);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(each.chatId);
      }
    }
  }
}

export const day = (date: string, hour = 12): Date =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);

export const humanActionsOf = (
  taskId: string,
  given: {
    openedBy?: string | null;
    openedAt?: Date;
    lineId?: string;
    asks?: readonly (readonly [string, Date])[];
    actions?: readonly (readonly [HumanActionKind, string, string, Date])[];
  } = {},
): TaskHumanActions => {
  const opened = TaskHumanActions.empty(
    TaskId.of(taskId),
    WORKSPACE,
  ).recordOpen(
    TaskOpening.of({
      teamId: TEAM,
      lineId: given.lineId ?? 'line_1',
      stationId: 'station_0',
      by:
        given.openedBy === null
          ? null
          : UserId.of(given.openedBy ?? 'user_ada'),
      at: given.openedAt ?? day('2026-09-28', 9),
    }),
  );
  const asked = (given.asks ?? []).reduce(
    (current, [stationId, at]) => current.asked(InboxAsk.of(stationId, at)),
    opened,
  );

  return (given.actions ?? []).reduce(
    (current, [act, by, stationId, at]) =>
      current.recordAction(
        TaskHumanAction.of({ kind: act, by: UserId.of(by), stationId, at }),
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
          stationId: each.stationId ?? 'station_1',
          runId: null,
          source: each.source ?? 'hook:notify',
          code: each.code ?? 'loop',
          occurrences: each.occurrences ?? 1,
          at: each.at,
        }),
      ),
    TaskFailures.empty(TaskId.of(taskId), WORKSPACE, TEAM),
  );

export const chatOf = (chatId: string, by: string, at: Date): ChatRecord =>
  ChatRecord.start({
    chatId,
    workspaceId: WORKSPACE,
    teamId: TEAM,
    startedBy: UserId.of(by),
    startedAt: at,
  });

export const historyOf = (parts: Partial<TeamHistory>): TeamHistory => ({
  records: [],
  taskPullRequests: [],
  taskHumanActions: [],
  failures: [],
  chats: [],
  ...parts,
});

export const taskPullRequestOf = (
  taskId: string,
  moments: {
    openedAt: Date;
    reviewedAt?: Date;
    closedAt?: Date;
    merged?: boolean;
  },
): TaskPullRequest => {
  const pullRequest = PullRequestUrl.of(
    `https://github.com/acme/api/pull/${taskId.replace(/\D/g, '') || '1'}`,
  );
  const opened = TaskPullRequest.open({
    taskId: TaskId.of(taskId),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest,
    at: moments.openedAt,
  });
  const reviewed = moments.reviewedAt
    ? opened.recordReview({
        pullRequest,
        at: moments.reviewedAt,
        byBot: false,
      })
    : opened;

  return moments.closedAt
    ? reviewed.close({
        pullRequest,
        merged: moments.merged ?? true,
        at: moments.closedAt,
      })
    : reviewed;
};
