import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceMemberLeft implements DomainEvent {
  readonly kind = 'workspace.member-left';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
    readonly at: Date,
  ) {}
}
