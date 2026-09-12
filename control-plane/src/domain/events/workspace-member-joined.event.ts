import type { DomainEvent } from '@domain/events/domain-event';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';

export class WorkspaceMemberJoined implements DomainEvent {
  readonly kind = 'workspace.member-joined';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
    readonly role: WorkspaceRole,
  ) {}
}
