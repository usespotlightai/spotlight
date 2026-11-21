import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceMemberUnsuspended implements DomainEvent {
  readonly kind = 'workspace.member-unsuspended';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
    readonly by: UserId,
    readonly at: Date,
  ) {}
}
