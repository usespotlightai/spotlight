import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxRequestMarkedRead } from '@work/domain/events/inbox-request-marked-read.event';
import { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import { InboxRequestReopened } from '@work/domain/events/inbox-request-reopened.event';
import { InboxRequestResolved } from '@work/domain/events/inbox-request-resolved.event';
import type { ConversationStanding } from '@work/domain/services/conversation-audience';
import {
  INBOX_REQUEST_FORMS,
  type InboxRequestForm,
} from '@work/domain/value-objects/inbox-request-form';
import type { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import type { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';

export type InboxRequestAccess = 'seesTeam' | 'actsOnTeam';

export interface InboxRequestVisibility {
  readonly form: InboxRequestForm;
  readonly viewer: UserId;
  readonly assignee: UserId | null;
  readonly seesTeam: boolean;
  readonly actsOnTeam: boolean;
}

export interface InboxRequestAudience {
  readonly assignee: UserId;
  readonly unassigned: boolean;
  readonly formsForTeamActors: readonly InboxRequestForm[];
}

export class InboxRequest extends EventRecorder {
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
  ) {
    super();
  }

  static create(input: {
    id: InboxRequestId;
    workspaceId: WorkspaceId;
    taskId: TaskId;
    form: InboxRequestForm;
    about: InboxRequestSubject;
    now: Date;
  }): InboxRequest {
    const created = new InboxRequest(
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
    created.record(
      new InboxRequestOpened(
        created.id,
        created.workspaceId,
        created.taskId,
        input.now,
      ),
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
        return 'actsOnTeam';
    }
  }

  static audienceOf(viewer: UserId): InboxRequestAudience {
    return {
      assignee: viewer,
      unassigned: true,
      formsForTeamActors: INBOX_REQUEST_FORMS.filter(
        (form) => InboxRequest.requiredAccess(form) === 'actsOnTeam',
      ),
    };
  }

  static visibleTo(visibility: InboxRequestVisibility): boolean {
    const audience = InboxRequest.audienceOf(visibility.viewer);

    if (audience.formsForTeamActors.includes(visibility.form)) {
      return visibility.actsOnTeam;
    }

    return visibility.assignee
      ? visibility.assignee.equals(audience.assignee)
      : audience.unassigned && visibility.seesTeam;
  }

  static standingOf(
    visibility: InboxRequestVisibility,
  ): ConversationStanding | null {
    if (visibility.assignee?.equals(visibility.viewer)) {
      return 'assignee';
    }

    return visibility.assignee === null && visibility.actsOnTeam
      ? 'team'
      : null;
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
    if (!this.unreadBy(viewer)) {
      return this;
    }

    const read = this.with({
      reads: [...this.reads, InboxRequestRead.of({ by: viewer, at: now })],
    });

    read.record(
      new InboxRequestMarkedRead(
        this.id,
        this.workspaceId,
        this.taskId,
        viewer,
      ),
    );

    return read;
  }

  resolve(now: Date): InboxRequest {
    if (!this.open) {
      return this;
    }

    const resolved = this.with(
      { resolvedAt: now },
      (event) =>
        !(
          event instanceof InboxRequestOpened ||
          event instanceof InboxRequestReopened
        ),
    );

    resolved.record(
      new InboxRequestResolved(this.id, this.workspaceId, this.taskId, now),
    );

    return resolved;
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
    reopened.inheritEvents(this);
    reopened.record(
      new InboxRequestReopened(
        reopened.id,
        reopened.workspaceId,
        reopened.taskId,
        now,
      ),
    );

    return reopened;
  }

  private with(
    change: {
      reads?: readonly InboxRequestRead[];
      resolvedAt?: Date;
    },
    keeps: (event: DomainEvent) => boolean = () => true,
  ): InboxRequest {
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
    next.inheritEvents(this, keeps);

    return next;
  }
}
