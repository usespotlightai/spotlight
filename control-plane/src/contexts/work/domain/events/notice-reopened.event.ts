import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';

export class NoticeReopened implements DomainEvent {
  readonly kind = 'notice.reopened';

  constructor(
    readonly noticeId: NoticeId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly addressee: UserId | null,
    readonly at: Date,
  ) {}
}
