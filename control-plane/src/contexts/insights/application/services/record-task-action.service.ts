import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { TaskActions } from '@insights/domain/aggregates/task-actions.aggregate';
import type { TaskActionsRepository } from '@insights/domain/repositories/task-actions.repository';
import {
  type DrivenRun,
  isLineWork,
} from '@insights/domain/services/line-work';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { actionKindOf } from '@insights/domain/value-objects/person-action.vo';
import { TaskAction } from '@insights/domain/value-objects/task-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TaskOpenedReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly by: string | null;
  readonly at: string;
}

export interface TaskAskedReceived extends DrivenRun {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly at: string;
}

export interface TaskActedOnReceived {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly action: string;
  readonly by: string;
  readonly at: string;
}

export class RecordTaskAction {
  constructor(
    private readonly taskActions: TaskActionsRepository,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
  ) {}

  opened(event: TaskOpenedReceived): Promise<void> {
    const opening = TaskOpening.of({
      teamId: TeamId.of(event.teamId),
      lineId: LineId.of(event.lineId),
      stationId: StationId.of(event.stationId),
      by: event.by ? UserId.of(event.by) : null,
      at: new Date(event.at),
    });

    return this.recording(
      event,
      (taskActions) => taskActions.recordOpen(opening),
      opening.teamId,
    );
  }

  asked(event: TaskAskedReceived): Promise<void> {
    if (!isLineWork(event)) {
      return Promise.resolve();
    }

    const ask = InboxAsk.of(StationId.of(event.stationId), new Date(event.at));

    return this.recording(event, (taskActions) => taskActions.asked(ask));
  }

  acted(event: TaskActedOnReceived): Promise<void> {
    const kind = actionKindOf(event.action);

    if (!kind) {
      return Promise.resolve();
    }

    const action = TaskAction.of({
      kind,
      by: UserId.of(event.by),
      stationId: StationId.of(event.stationId),
      at: new Date(event.at),
    });

    return this.recording(event, (taskActions) =>
      taskActions.recordAction(action),
    );
  }

  private recording(
    event: { readonly taskId: string; readonly workspaceId: string },
    change: (taskActions: TaskActions) => TaskActions,
    teamId: TeamId | null = null,
  ): Promise<void> {
    const taskId = TaskId.of(event.taskId);
    const workspaceId = WorkspaceId.of(event.workspaceId);

    const owner = FactOwner.of(workspaceId, { teamId, taskId });

    return this.transaction.inTransaction(() =>
      this.recorder.record(this.taskActions, {
        owner,
        deleted: (existing) => existing.delete(),
        load: () => this.taskActions.of(taskId),
        ownerOf: (existing) => owner.withTeam(existing.opening?.teamId),
        fresh: () => TaskActions.empty(taskId, workspaceId),
        change,
      }),
    );
  }
}
