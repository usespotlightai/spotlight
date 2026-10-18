import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import { humanActionKindOf } from '@insights/domain/value-objects/human-action.vo';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
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

export interface TaskAskedReceived {
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

export class RecordTaskHumanAction {
  constructor(
    private readonly humanActions: TaskHumanActionsRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  opened(event: TaskOpenedReceived): Promise<void> {
    const opening = TaskOpening.of({
      teamId: TeamId.of(event.teamId),
      lineId: event.lineId,
      stationId: event.stationId,
      by: event.by ? UserId.of(event.by) : null,
      at: new Date(event.at),
    });

    return this.recording(
      event,
      (humanActions) => humanActions.recordOpen(opening),
      opening.teamId,
    );
  }

  asked(event: TaskAskedReceived): Promise<void> {
    const ask = InboxAsk.of(event.stationId, new Date(event.at));

    return this.recording(event, (humanActions) => humanActions.asked(ask));
  }

  acted(event: TaskActedOnReceived): Promise<void> {
    const kind = humanActionKindOf(event.action);

    if (!kind) {
      return Promise.resolve();
    }

    const action = TaskHumanAction.of({
      kind,
      by: UserId.of(event.by),
      stationId: event.stationId,
      at: new Date(event.at),
    });

    return this.recording(event, (humanActions) =>
      humanActions.recordAction(action),
    );
  }

  private recording(
    event: { readonly taskId: string; readonly workspaceId: string },
    change: (humanActions: TaskHumanActions) => TaskHumanActions,
    teamId: TeamId | null = null,
  ): Promise<void> {
    const taskId = TaskId.of(event.taskId);
    const workspaceId = WorkspaceId.of(event.workspaceId);

    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const existing = await this.humanActions.of(taskId);

      if (
        teamId &&
        (await this.deletions.isDeleted(workspaceId, taskId, teamId))
      ) {
        if (existing) {
          await this.humanActions.removeForTask(taskId);
        }
        return;
      }

      if (!existing) {
        if (!(await this.deletions.isDeleted(workspaceId, taskId))) {
          await this.humanActions.add(
            change(TaskHumanActions.empty(taskId, workspaceId)),
          );
        }
        return;
      }

      const recorded = change(existing);

      if (recorded !== existing) {
        await this.humanActions.save(recorded);
      }
    });
  }
}
