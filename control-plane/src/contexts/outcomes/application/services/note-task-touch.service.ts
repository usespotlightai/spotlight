import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import type { TaskTouchesRepository } from '@outcomes/domain/repositories/task-touches.repository';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import { personActOf } from '@outcomes/domain/value-objects/next-act.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
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
  readonly act: string;
  readonly by: string;
  readonly at: string;
}

export class NoteTaskTouch {
  constructor(
    private readonly touches: TaskTouchesRepository,
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

    return this.touched(
      event,
      (touches) => touches.recordOpen(opening),
      opening.teamId,
    );
  }

  asked(event: TaskAskedReceived): Promise<void> {
    const ask = InboxAsk.of(event.stationId, new Date(event.at));

    return this.touched(event, (touches) => touches.asked(ask));
  }

  acted(event: TaskActedOnReceived): Promise<void> {
    const act = personActOf(event.act);

    if (!act) {
      return Promise.resolve();
    }

    const touch = PersonTouch.of({
      act,
      by: UserId.of(event.by),
      stationId: event.stationId,
      at: new Date(event.at),
    });

    return this.touched(event, (touches) => touches.recordAction(touch));
  }

  private touched(
    event: { readonly taskId: string; readonly workspaceId: string },
    change: (touches: TaskTouches) => TaskTouches,
    teamId: TeamId | null = null,
  ): Promise<void> {
    const taskId = TaskId.of(event.taskId);
    const workspaceId = WorkspaceId.of(event.workspaceId);

    return this.transaction.inTransaction(async () => {
      await this.deletions.lockDeletion(workspaceId, taskId, teamId);
      const existing = await this.touches.of(taskId);

      if (
        teamId &&
        (await this.deletions.isDeleted(workspaceId, taskId, teamId))
      ) {
        if (existing) {
          await this.touches.removeForTask(taskId);
        }
        return;
      }

      if (!existing) {
        if (!(await this.deletions.isDeleted(workspaceId, taskId))) {
          await this.touches.add(
            change(TaskTouches.empty(taskId, workspaceId)),
          );
        }
        return;
      }

      const touched = change(existing);

      if (touched !== existing) {
        await this.touches.save(touched);
      }
    });
  }
}
