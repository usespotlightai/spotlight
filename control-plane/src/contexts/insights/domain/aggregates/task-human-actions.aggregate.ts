import { TaskHumanActionsErased } from '@insights/domain/events/task-human-actions-erased.event';
import { TaskOpeningRecorded } from '@insights/domain/events/task-opening-recorded.event';
import type { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import type { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import type { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InboxWait {
  readonly stationId: StationId;
  readonly askedAt: Date;
  readonly answeredAt: Date | null;
  readonly answeredBy: string | null;
}

const byTime = <T extends { readonly at: Date }>(one: T, other: T): number =>
  one.at.getTime() - other.at.getTime();

export class TaskHumanActions extends EventRecorder {
  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly opening: TaskOpening | null,
    readonly asks: readonly InboxAsk[],
    readonly actions: readonly TaskHumanAction[],
    readonly version: number,
  ) {
    super();
  }

  static empty(taskId: TaskId, workspaceId: WorkspaceId): TaskHumanActions {
    return new TaskHumanActions(taskId, workspaceId, null, [], [], 0);
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    opening: TaskOpening | null;
    asks: readonly InboxAsk[];
    actions: readonly TaskHumanAction[];
    version: number;
  }): TaskHumanActions {
    return new TaskHumanActions(
      input.taskId,
      input.workspaceId,
      input.opening,
      [...input.asks].sort(byTime),
      [...input.actions].sort(byTime),
      input.version,
    );
  }

  get lastActionAt(): Date | null {
    const times = [
      this.opening?.at,
      this.asks[this.asks.length - 1]?.at,
      this.actions[this.actions.length - 1]?.at,
    ].flatMap((each) => (each ? [each.getTime()] : []));

    return times.length > 0 ? new Date(Math.max(...times)) : null;
  }

  recordOpen(opening: TaskOpening): TaskHumanActions {
    if (this.opening) {
      return this;
    }

    const opened = this.with({ opening });

    opened.record(new TaskOpeningRecorded(this.taskId, this.workspaceId));

    return opened;
  }

  erased(): TaskHumanActions {
    const erased = this.with({});

    erased.record(new TaskHumanActionsErased(this.taskId, this.workspaceId));

    return erased;
  }

  asked(ask: InboxAsk): TaskHumanActions {
    return this.asks.some((each) => each.equals(ask))
      ? this
      : this.with({ asks: [...this.asks, ask].sort(byTime) });
  }

  recordAction(action: TaskHumanAction): TaskHumanActions {
    return this.actions.some((each) => each.equals(action))
      ? this
      : this.with({ actions: [...this.actions, action].sort(byTime) });
  }

  waits(): readonly InboxWait[] {
    return this.asks.map((ask, at) => {
      const nextAsk = this.asks[at + 1];
      const answer = this.actions.find(
        (action) =>
          action.at.getTime() >= ask.at.getTime() &&
          (!nextAsk || action.at.getTime() < nextAsk.at.getTime()),
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
    actions?: readonly TaskHumanAction[];
  }): TaskHumanActions {
    const next = new TaskHumanActions(
      this.taskId,
      this.workspaceId,
      change.opening ?? this.opening,
      change.asks ?? this.asks,
      change.actions ?? this.actions,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
