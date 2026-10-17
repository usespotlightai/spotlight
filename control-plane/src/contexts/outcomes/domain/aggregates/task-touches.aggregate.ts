import type { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import type { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import type { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InboxWait {
  readonly stationId: string;
  readonly askedAt: Date;
  readonly answeredAt: Date | null;
  readonly answeredBy: string | null;
}

const byTime = <T extends { readonly at: Date }>(one: T, other: T): number =>
  one.at.getTime() - other.at.getTime();

export class TaskTouches {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly opening: TaskOpening | null,
    readonly asks: readonly InboxAsk[],
    readonly acts: readonly PersonTouch[],
    readonly version: number,
  ) {}

  static empty(taskId: TaskId, workspaceId: WorkspaceId): TaskTouches {
    return new TaskTouches(taskId, workspaceId, null, [], [], 0);
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    opening: TaskOpening | null;
    asks: readonly InboxAsk[];
    acts: readonly PersonTouch[];
    version: number;
  }): TaskTouches {
    return new TaskTouches(
      input.taskId,
      input.workspaceId,
      input.opening,
      [...input.asks].sort(byTime),
      [...input.acts].sort(byTime),
      input.version,
    );
  }

  get touchedAt(): Date | null {
    const times = [
      this.opening?.at,
      this.asks[this.asks.length - 1]?.at,
      this.acts[this.acts.length - 1]?.at,
    ].flatMap((each) => (each ? [each.getTime()] : []));

    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }

  recordOpen(opening: TaskOpening): TaskTouches {
    return this.opening ? this : this.with({ opening });
  }

  asked(ask: InboxAsk): TaskTouches {
    return this.asks.some((each) => each.equals(ask))
      ? this
      : this.with({ asks: [...this.asks, ask].sort(byTime) });
  }

  recordAction(act: PersonTouch): TaskTouches {
    return this.acts.some((each) => each.equals(act))
      ? this
      : this.with({ acts: [...this.acts, act].sort(byTime) });
  }

  waits(): readonly InboxWait[] {
    return this.asks.map((ask, at) => {
      const nextAsk = this.asks[at + 1];
      const answer = this.acts.find(
        (act) =>
          act.at.getTime() >= ask.at.getTime() &&
          (!nextAsk || act.at.getTime() < nextAsk.at.getTime()),
      );

      return {
        stationId: ask.stationId,
        askedAt: ask.at,
        answeredAt: answer?.at ?? null,
        answeredBy: answer?.by.value ?? null,
      };
    });
  }

  private with(change: {
    opening?: TaskOpening;
    asks?: readonly InboxAsk[];
    acts?: readonly PersonTouch[];
  }): TaskTouches {
    return new TaskTouches(
      this.taskId,
      this.workspaceId,
      change.opening ?? this.opening,
      change.asks ?? this.asks,
      change.acts ?? this.acts,
      this.version,
    );
  }
}
