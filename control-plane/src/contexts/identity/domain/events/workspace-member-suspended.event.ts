import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceMemberSuspended implements DomainEvent {
  readonly kind = 'workspace.member-suspended';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
    readonly by: UserId,
    readonly at: Date,
  ) {}
}
