import type { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceMemberRoleChanged implements DomainEvent {
  readonly kind = 'workspace.member-role-changed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly userId: UserId,
    readonly was: WorkspaceRole,
    readonly now: WorkspaceRole,
    readonly by: UserId,
  ) {}
}
