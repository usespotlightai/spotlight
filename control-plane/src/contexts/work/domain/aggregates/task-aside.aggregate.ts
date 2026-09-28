import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskAsideRaised } from '@work/domain/events/task-aside-raised.event';
import { TaskAsideSettled } from '@work/domain/events/task-aside-settled.event';
import type { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import {
  type AsideForm,
  asideForm,
} from '@work/domain/value-objects/aside-form';
import { AsideRead } from '@work/domain/value-objects/aside-read.vo';
import type { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';

export interface AsideAttendance {
  readonly viewer: UserId;
  readonly assignee: UserId | null;
  readonly onTeam: boolean;
}

export class TaskAside extends EventRecorder {
  private constructor(
    readonly id: TaskAsideId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly form: AsideForm,
    readonly about: AsideAbout,
    readonly raisedAt: Date,
    readonly reads: readonly AsideRead[],
    readonly settledAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static raised(input: {
    id: TaskAsideId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: string;
    about: AsideAbout;
    now: Date;
  }): TaskAside {
    const form = asideForm(input.form);
    const { about } = input;
    const raised = new TaskAside(
      input.id,
      input.workspaceId,
      input.taskId,
      form,
      about,
      input.now,
      [],
      null,
      0,
    );
    raised.record(new TaskAsideRaised(input.id, input.taskId, form, about));
    return raised;
  }

  static rehydrate(input: {
    id: TaskAsideId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: AsideForm;
    about: AsideAbout;
    raisedAt: Date;
    reads: readonly AsideRead[];
    settledAt: Date | null;
    version: number;
  }): TaskAside {
    if (input.settledAt && input.settledAt < input.raisedAt) {
      throw new InconsistentStateError(
        'task aside',
        'was settled before it was raised',
      );
    }

    if (input.reads.some((each) => each.at < input.raisedAt)) {
      throw new InconsistentStateError(
        'task aside',
        'was read before it was raised',
      );
    }

    if (
      new Set(input.reads.map((each) => each.by.value)).size !==
      input.reads.length
    ) {
      throw new InconsistentStateError(
        'task aside',
        'was read twice by the same person',
      );
    }

    return new TaskAside(
      input.id,
      input.workspaceId,
      input.taskId,
      input.form,
      input.about,
      input.raisedAt,
      input.reads,
      input.settledAt,
      input.version,
    );
  }

  static attendedBy(attendance: AsideAttendance): boolean {
    return attendance.assignee
      ? attendance.assignee.equals(attendance.viewer)
      : attendance.onTeam;
  }

  get open(): boolean {
    return this.settledAt === null;
  }

  unreadBy(viewer: UserId): boolean {
    return !this.reads.some((each) => each.by.equals(viewer));
  }

  readBy(viewer: UserId, now: Date): TaskAside {
    return this.unreadBy(viewer)
      ? this.with({
          reads: [...this.reads, AsideRead.of({ by: viewer, at: now })],
        })
      : this;
  }

  settled(now: Date): TaskAside {
    if (!this.open) {
      return this;
    }

    const settled = this.with({ settledAt: now });
    settled.record(new TaskAsideSettled(this.id, this.taskId));
    return settled;
  }

  private with(change: {
    reads?: readonly AsideRead[];
    settledAt?: Date;
  }): TaskAside {
    const next = new TaskAside(
      this.id,
      this.workspaceId,
      this.taskId,
      this.form,
      this.about,
      this.raisedAt,
      change.reads ?? this.reads,
      change.settledAt ?? this.settledAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
