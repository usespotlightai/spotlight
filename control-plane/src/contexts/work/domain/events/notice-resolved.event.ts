import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { NoticeId } from '@work/domain/value-objects/notice-id.vo';

export class NoticeResolved implements DomainEvent {
  readonly kind = 'notice.resolved';

  constructor(
    readonly noticeId: NoticeId,
    readonly workspaceId: WorkspaceId,
    readonly addressee: UserId | null,
    readonly at: Date,
  ) {}
}
