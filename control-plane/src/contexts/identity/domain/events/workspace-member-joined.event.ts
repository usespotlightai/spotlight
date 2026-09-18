import type { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceMemberJoined implements DomainEvent {
  readonly kind = 'workspace.member-joined';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
    readonly role: WorkspaceRole,
  ) {}
}
