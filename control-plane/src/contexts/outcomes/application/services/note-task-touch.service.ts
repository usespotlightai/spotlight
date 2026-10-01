import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
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

export interface TaskOpenedHeard {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly by: string | null;
  readonly at: string;
}

export interface TaskAskedHeard {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly at: string;
}

export interface TaskActedOnHeard {
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
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  opened(heard: TaskOpenedHeard): Promise<void> {
    const opening = TaskOpening.of({
      teamId: TeamId.of(heard.teamId),
      lineId: heard.lineId,
      stationId: heard.stationId,
      by: heard.by ? UserId.of(heard.by) : null,
      at: new Date(heard.at),
    });

    return this.touched(heard, (held) => held.opened(opening), opening.teamId);
  }

  asked(heard: TaskAskedHeard): Promise<void> {
    const ask = InboxAsk.of(heard.stationId, new Date(heard.at));

    return this.touched(heard, (held) => held.asked(ask));
  }

  acted(heard: TaskActedOnHeard): Promise<void> {
    const act = personActOf(heard.act);

    if (!act) {
      return Promise.resolve();
    }

    const touch = PersonTouch.of({
      act,
      by: UserId.of(heard.by),
      stationId: heard.stationId,
      at: new Date(heard.at),
    });

    return this.touched(heard, (held) => held.actedOn(touch));
  }

  private touched(
    heard: { readonly taskId: string; readonly workspaceId: string },
    change: (held: TaskTouches) => TaskTouches,
    teamId: TeamId | null = null,
  ): Promise<void> {
    const taskId = TaskId.of(heard.taskId);
    const workspaceId = WorkspaceId.of(heard.workspaceId);

    return this.transaction.run(async () => {
      await this.forgotten.holding(workspaceId, taskId, teamId);
      const held = await this.touches.of(taskId);

      if (
        teamId &&
        (await this.forgotten.forgot(workspaceId, taskId, teamId))
      ) {
        if (held) {
          await this.touches.removeForTask(taskId);
        }
        return;
      }

      if (!held) {
        if (!(await this.forgotten.forgot(workspaceId, taskId))) {
          await this.touches.add(
            change(TaskTouches.heardOf(taskId, workspaceId)),
          );
        }
        return;
      }

      const touched = change(held);

      if (touched !== held) {
        await this.touches.save(touched);
      }
    });
  }
}
