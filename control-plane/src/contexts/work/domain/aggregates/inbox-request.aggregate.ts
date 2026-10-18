import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxRequestCreated } from '@work/domain/events/inbox-request-created.event';
import { InboxRequestResolved } from '@work/domain/events/inbox-request-resolved.event';
import {
  type InboxRequestForm,
  inboxRequestForm,
} from '@work/domain/value-objects/inbox-request-form';
import type { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import type { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';

export type InboxRequestAccess = 'seesTeam' | 'readsTeamInsights';

export interface InboxRequestVisibility {
  readonly form: InboxRequestForm;
  readonly viewer: UserId;
  readonly assignee: UserId | null;
  readonly seesTeam: boolean;
  readonly readsTeamInsights: boolean;
}

export class InboxRequest extends EventRecorder {
  private constructor(
    readonly id: InboxRequestId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly form: InboxRequestForm,
    readonly about: InboxRequestSubject,
    readonly createdAt: Date,
    readonly reads: readonly InboxRequestRead[],
    readonly resolvedAt: Date | null,
    readonly version: number,
  ) {
    super();
  }

  static create(input: {
    id: InboxRequestId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: string;
    about: InboxRequestSubject;
    now: Date;
  }): InboxRequest {
    const form = inboxRequestForm(input.form);
    const { about } = input;
    const created = new InboxRequest(
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
    created.record(
      new InboxRequestCreated(input.id, input.taskId, form, about),
    );
    return created;
  }

  static rehydrate(input: {
    id: InboxRequestId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: InboxRequestForm;
    about: InboxRequestSubject;
    createdAt: Date;
    reads: readonly InboxRequestRead[];
    resolvedAt: Date | null;
    version: number;
  }): InboxRequest {
    if (input.resolvedAt && input.resolvedAt < input.createdAt) {
      throw new InconsistentStateError(
        'inbox request',
        'was resolved before it was created',
      );
    }

    if (input.reads.some((each) => each.at < input.createdAt)) {
      throw new InconsistentStateError(
        'inbox request',
        'was read before it was created',
      );
    }

    if (
      new Set(input.reads.map((each) => each.by.value)).size !==
      input.reads.length
    ) {
      throw new InconsistentStateError(
        'inbox request',
        'was read twice by the same person',
      );
    }

    return new InboxRequest(
      input.id,
      input.workspaceId,
      input.taskId,
      input.form,
      input.about,
      input.createdAt,
      input.reads,
      input.resolvedAt,
      input.version,
    );
  }

  static requiredAccess(form: InboxRequestForm): InboxRequestAccess {
    switch (form) {
      case 'memories':
        return 'seesTeam';
      case 'grade':
      case 'alert':
        return 'readsTeamInsights';
    }
  }

  static visibleTo(visibility: InboxRequestVisibility): boolean {
    if (InboxRequest.requiredAccess(visibility.form) === 'readsTeamInsights') {
      return visibility.readsTeamInsights;
    }

    return visibility.assignee
      ? visibility.assignee.equals(visibility.viewer)
      : visibility.seesTeam;
  }

  get open(): boolean {
    return this.resolvedAt === null;
  }

  unreadBy(viewer: UserId): boolean {
    return !this.reads.some((each) => each.by.equals(viewer));
  }

  readBy(viewer: UserId, now: Date): InboxRequest {
    return this.unreadBy(viewer)
      ? this.with({
          reads: [...this.reads, InboxRequestRead.of({ by: viewer, at: now })],
        })
      : this;
  }

  resolve(now: Date): InboxRequest {
    if (!this.open) {
      return this;
    }

    const resolved = this.with({ resolvedAt: now });
    resolved.record(new InboxRequestResolved(this.id, this.taskId));
    return resolved;
  }

  reopen(now: Date): InboxRequest {
    if (this.open) {
      return this;
    }

    const reopened = new InboxRequest(
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
      new InboxRequestCreated(this.id, this.taskId, this.form, this.about),
    );
    return reopened;
  }

  private with(change: {
    reads?: readonly InboxRequestRead[];
    resolvedAt?: Date;
  }): InboxRequest {
    const next = new InboxRequest(
      this.id,
      this.workspaceId,
      this.taskId,
      this.form,
      this.about,
      this.createdAt,
      change.reads ?? this.reads,
      change.resolvedAt ?? this.resolvedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
