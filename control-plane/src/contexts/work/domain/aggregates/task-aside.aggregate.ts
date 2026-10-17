import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskAsideRaised } from '@work/domain/events/task-aside-raised.event';
import { TaskAsideResolved } from '@work/domain/events/task-aside-resolved.event';
import type { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import {
  type AsideForm,
  asideForm,
} from '@work/domain/value-objects/aside-form';
import { AsideRead } from '@work/domain/value-objects/aside-read.vo';
import type { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';

export type AsideAccess = 'seesTeam' | 'readsTeamOutcomes';

export interface AsideAttendance {
  readonly form: AsideForm;
  readonly viewer: UserId;
  readonly assignee: UserId | null;
  readonly seesTeam: boolean;
  readonly readsTeamOutcomes: boolean;
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
    readonly resolvedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static raise(input: {
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
    resolvedAt: Date | null;
    version: number;
  }): TaskAside {
    if (input.resolvedAt && input.resolvedAt < input.raisedAt) {
      throw new InconsistentStateError(
        'task aside',
        'was resolved before it was raised',
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
      input.resolvedAt,
      input.version,
    );
  }

  static requiredAccess(form: AsideForm): AsideAccess {
    switch (form) {
      case 'memories':
        return 'seesTeam';
      case 'grade':
      case 'alert':
        return 'readsTeamOutcomes';
    }
  }

  static attendedBy(attendance: AsideAttendance): boolean {
    if (TaskAside.requiredAccess(attendance.form) === 'readsTeamOutcomes') {
      return attendance.readsTeamOutcomes;
    }

    return attendance.assignee
      ? attendance.assignee.equals(attendance.viewer)
      : attendance.seesTeam;
  }

  get open(): boolean {
    return this.resolvedAt === null;
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

  resolve(now: Date): TaskAside {
    if (!this.open) {
      return this;
    }

    const resolved = this.with({ resolvedAt: now });
    resolved.record(new TaskAsideResolved(this.id, this.taskId));
    return resolved;
  }

  reopen(now: Date): TaskAside {
    if (this.open) {
      return this;
    }

    const reopened = new TaskAside(
      this.id,
      this.workspaceId,
      this.taskId,
      this.form,
      this.about,
      now,
      [],
      null,
      this.version,
    );

    reopened.inheritEvents(this);
    reopened.record(
      new TaskAsideRaised(this.id, this.taskId, this.form, this.about),
    );
    return reopened;
  }

  private with(change: {
    reads?: readonly AsideRead[];
    resolvedAt?: Date;
  }): TaskAside {
    const next = new TaskAside(
      this.id,
      this.workspaceId,
      this.taskId,
      this.form,
      this.about,
      this.raisedAt,
      change.reads ?? this.reads,
      change.resolvedAt ?? this.resolvedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
