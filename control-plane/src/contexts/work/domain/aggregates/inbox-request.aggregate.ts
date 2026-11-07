import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
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

export class InboxRequest {
  private constructor(
    readonly id: InboxRequestId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly form: InboxRequestForm,
    readonly about: InboxRequestSubject,
    readonly createdAt: Date,
    readonly openedAt: Date,
    readonly reads: readonly InboxRequestRead[],
    readonly resolvedAt: Date | null,
    readonly version: number,
  ) {}

  static create(input: {
    id: InboxRequestId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: InboxRequestForm;
    about: InboxRequestSubject;
    now: Date;
  }): InboxRequest {
    return new InboxRequest(
      input.id,
      input.workspaceId,
      input.taskId,
      input.form,
      input.about,
      input.now,
      input.now,
      [],
      null,
      0,
    );
  }

  static rehydrate(input: {
    id: InboxRequestId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: InboxRequestForm;
    about: InboxRequestSubject;
    createdAt: Date;
    openedAt: Date;
    reads: readonly InboxRequestRead[];
    resolvedAt: Date | null;
    version: number;
  }): InboxRequest {
    if (input.version < 0) {
      throw new InconsistentStateError(
        'inbox request',
        'has a negative version',
      );
    }

    if (input.openedAt < input.createdAt) {
      throw new InconsistentStateError(
        'inbox request',
        'was opened before it was created',
      );
    }

    if (input.resolvedAt && input.resolvedAt < input.openedAt) {
      throw new InconsistentStateError(
        'inbox request',
        'was resolved before it was opened',
      );
    }

    if (input.reads.some((each) => each.at < input.openedAt)) {
      throw new InconsistentStateError(
        'inbox request',
        'was read before it was opened',
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
      input.openedAt,
      input.reads,
      input.resolvedAt,
      input.version,
    );
  }

  static reopenable(resolvedAt: Date | null): boolean {
    return resolvedAt !== null;
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

  static unread(seen: {
    readonly readAt: Date | null;
    readonly resolvedAt: Date | null;
  }): boolean {
    return seen.readAt === null && seen.resolvedAt === null;
  }

  get open(): boolean {
    return this.resolvedAt === null;
  }

  unreadBy(viewer: UserId): boolean {
    return InboxRequest.unread({
      readAt: this.reads.find((each) => each.by.equals(viewer))?.at ?? null,
      resolvedAt: this.resolvedAt,
    });
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

    return this.with({ resolvedAt: now });
  }

  reopen(now: Date): InboxRequest {
    if (!InboxRequest.reopenable(this.resolvedAt)) {
      return this;
    }

    const reopened = new InboxRequest(
      this.id,
      this.workspaceId,
      this.taskId,
      this.form,
      this.about,
      this.createdAt,
      now,
      [],
      null,
      this.version,
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
      this.openedAt,
      change.reads ?? this.reads,
      change.resolvedAt ?? this.resolvedAt,
      this.version,
    );

    return next;
  }
}
