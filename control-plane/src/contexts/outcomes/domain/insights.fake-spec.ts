import { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import { ChatRecordMovedOnError } from '@outcomes/domain/exceptions/chat-record-moved-on.error';
import { TaskFailuresMovedOnError } from '@outcomes/domain/exceptions/task-failures-moved-on.error';
import { TaskTouchesMovedOnError } from '@outcomes/domain/exceptions/task-touches-moved-on.error';
import {
  type RunRecordsInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import type { ChatRecordRepository } from '@outcomes/domain/repositories/chat-record.repository';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import type { TaskFailuresRepository } from '@outcomes/domain/repositories/task-failures.repository';
import type { TaskTouchesRepository } from '@outcomes/domain/repositories/task-touches.repository';
import type { TeamHistory } from '@outcomes/domain/services/team-history';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import type { PersonAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const inWindow = (window: TeamWindow, at: Date | null): boolean =>
  at !== null &&
  at.getTime() >= window.from.getTime() &&
  at.getTime() < window.to.getTime();

export class TaskTouchesInMemory implements TaskTouchesRepository {
  readonly held = new Map<string, TaskTouches>();

  constructor(private readonly records?: RunRecordsInMemory) {}

  async add(touches: TaskTouches): Promise<void> {
    if (this.held.has(touches.taskId.value)) {
      throw new TaskTouchesMovedOnError(touches.taskId.value);
    }
    this.held.set(touches.taskId.value, touches);
  }

  async save(touches: TaskTouches): Promise<void> {
    const held = this.held.get(touches.taskId.value);

    if (!held || held.version !== touches.version) {
      throw new TaskTouchesMovedOnError(touches.taskId.value);
    }
    this.held.set(
      touches.taskId.value,
      TaskTouches.rehydrate({ ...touches, version: touches.version + 1 }),
    );
  }

  async of(taskId: TaskId): Promise<TaskTouches | null> {
    return this.held.get(taskId.value) ?? null;
  }

  async forTasks(taskIds: readonly TaskId[]): Promise<readonly TaskTouches[]> {
    return taskIds.flatMap((each) => {
      const held = this.held.get(each.value);
      return held ? [held] : [];
    });
  }

  async ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly TaskTouches[]> {
    const worked = new Set(
      (
        (await this.records?.endedForTeam(window, Number.MAX_SAFE_INTEGER)) ??
        []
      ).flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
    );

    return [...this.held.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          (worked.has(each.taskId.value) ||
            (each.opening?.teamId.equals(window.teamId) &&
              (each.touchedAt?.getTime() ?? 0) >= window.from.getTime() &&
              each.opening.at.getTime() < window.to.getTime())),
      )
      .slice(0, most);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    this.held.delete(taskId.value);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.opening?.teamId.equals(teamId)
      ) {
        this.held.delete(each.taskId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.taskId.value);
      }
    }
  }
}

export class TaskFailuresInMemory implements TaskFailuresRepository {
  readonly held = new Map<string, TaskFailures>();

  async add(failures: TaskFailures): Promise<void> {
    if (this.held.has(failures.taskId.value)) {
      throw new TaskFailuresMovedOnError(failures.taskId.value);
    }
    this.held.set(failures.taskId.value, failures);
  }

  async save(failures: TaskFailures): Promise<void> {
    const held = this.held.get(failures.taskId.value);

    if (!held || held.version !== failures.version) {
      throw new TaskFailuresMovedOnError(failures.taskId.value);
    }
    this.held.set(
      failures.taskId.value,
      TaskFailures.rehydrate({ ...failures, version: failures.version + 1 }),
    );
  }

  async of(taskId: TaskId): Promise<TaskFailures | null> {
    return this.held.get(taskId.value) ?? null;
  }

  async ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly TaskFailures[]> {
    return [...this.held.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          each.teamId.equals(window.teamId) &&
          (each.lastAt?.getTime() ?? 0) >= window.from.getTime(),
      )
      .slice(0, most);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    this.held.delete(taskId.value);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.held.delete(each.taskId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.taskId.value);
      }
    }
  }
}

export class ChatRecordsInMemory implements ChatRecordRepository {
  readonly held = new Map<string, ChatRecord>();

  async add(record: ChatRecord): Promise<void> {
    if (this.held.has(record.chatId)) {
      throw new ChatRecordMovedOnError(record.chatId);
    }
    this.held.set(record.chatId, record);
  }

  async of(chatId: string): Promise<ChatRecord | null> {
    return this.held.get(chatId) ?? null;
  }

  async ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly ChatRecord[]> {
    return [...this.held.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          each.teamId.equals(window.teamId) &&
          inWindow(window, each.startedAt),
      )
      .slice(0, most);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.held.delete(each.chatId);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.chatId);
      }
    }
  }
}

export const day = (date: string, hour = 12): Date =>
  new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);

export const touchesOf = (
  taskId: string,
  touched: {
    openedBy?: string | null;
    openedAt?: Date;
    lineId?: string;
    asks?: readonly (readonly [string, Date])[];
    acts?: readonly (readonly [PersonAct, string, string, Date])[];
  } = {},
): TaskTouches => {
  const opened = TaskTouches.heardOf(TaskId.of(taskId), WORKSPACE).opened(
    TaskOpening.of({
      teamId: TEAM,
      lineId: touched.lineId ?? 'line_1',
      stationId: 'station_0',
      by:
        touched.openedBy === null
          ? null
          : UserId.of(touched.openedBy ?? 'user_ada'),
      at: touched.openedAt ?? day('2026-09-28', 9),
    }),
  );
  const asked = (touched.asks ?? []).reduce(
    (held, [stationId, at]) => held.asked(InboxAsk.of(stationId, at)),
    opened,
  );

  return (touched.acts ?? []).reduce(
    (held, [act, by, stationId, at]) =>
      held.actedOn(PersonTouch.of({ act, by: UserId.of(by), stationId, at })),
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
    (held, each) =>
      held.raised(
        FailureOccurrence.of({
          stationId: each.stationId ?? 'station_1',
          runId: null,
          source: each.source ?? 'hook:notify',
          code: each.code ?? 'loop',
          occurrences: each.occurrences ?? 1,
          at: each.at,
        }),
      ),
    TaskFailures.heardOf(TaskId.of(taskId), WORKSPACE, TEAM),
  );

export const chatOf = (chatId: string, by: string, at: Date): ChatRecord =>
  ChatRecord.started({
    chatId,
    workspaceId: WORKSPACE,
    teamId: TEAM,
    startedBy: UserId.of(by),
    startedAt: at,
  });

export const historyOf = (held: Partial<TeamHistory>): TeamHistory => ({
  records: [],
  deliveries: [],
  touches: [],
  failures: [],
  chats: [],
  ...held,
});

export const deliveredOf = (
  taskId: string,
  delivered: {
    openedAt: Date;
    reviewedAt?: Date;
    closedAt?: Date;
    merged?: boolean;
  },
): TaskDelivery => {
  const pullRequest = PullRequestUrl.of(
    `https://github.com/acme/api/pull/${taskId.replace(/\D/g, '') || '1'}`,
  );
  const opened = TaskDelivery.opened({
    taskId: TaskId.of(taskId),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest,
    at: delivered.openedAt,
  });
  const reviewed = delivered.reviewedAt
    ? opened.reviewed({ pullRequest, at: delivered.reviewedAt, byBot: false })
    : opened;

  return delivered.closedAt
    ? reviewed.closed({
        pullRequest,
        merged: delivered.merged ?? true,
        at: delivered.closedAt,
      })
    : reviewed;
};
