import { TaskActionsErased } from '@insights/domain/events/task-actions-erased.event';
import { TaskOpeningRecorded } from '@insights/domain/events/task-opening-recorded.event';
import type { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import type { TaskAction } from '@insights/domain/value-objects/task-action.vo';
import type { TaskOpening } from '@insights/domain/value-objects/task-opening.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const byTime = <T extends { readonly at: Date }>(one: T, other: T): number =>
  one.at.getTime() - other.at.getTime();

export class TaskActions extends EventRecorder {
  private deleted = false;

  private constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly opening: TaskOpening | null,
    readonly asks: readonly InboxAsk[],
    readonly actions: readonly TaskAction[],
    readonly version: number,
  ) {
    super();
  }

  static empty(taskId: TaskId, workspaceId: WorkspaceId): TaskActions {
    return new TaskActions(taskId, workspaceId, null, [], [], 0);
  }

  static rehydrate(input: {
    taskId: TaskId;
    workspaceId: WorkspaceId;
    opening: TaskOpening | null;
    asks: readonly InboxAsk[];
    actions: readonly TaskAction[];
    version: number;
  }): TaskActions {
    return new TaskActions(
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

  recordOpen(opening: TaskOpening): TaskActions {
    if (this.opening) {
      return this;
    }

    const opened = this.with({ opening });

    opened.record(new TaskOpeningRecorded(this.taskId, this.workspaceId));

    return opened;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): TaskActions {
    const deleted = this.with({});

    deleted.deleted = true;
    deleted.record(new TaskActionsErased(this.taskId, this.workspaceId));

    return deleted;
  }

  asked(ask: InboxAsk): TaskActions {
    return this.asks.some((each) => each.equals(ask))
      ? this
      : this.with({ asks: [...this.asks, ask].sort(byTime) });
  }

  recordAction(action: TaskAction): TaskActions {
    return this.actions.some((each) => each.equals(action))
      ? this
      : this.with({ actions: [...this.actions, action].sort(byTime) });
  }

  private with(change: {
    opening?: TaskOpening;
    asks?: readonly InboxAsk[];
    actions?: readonly TaskAction[];
  }): TaskActions {
    const next = new TaskActions(
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
