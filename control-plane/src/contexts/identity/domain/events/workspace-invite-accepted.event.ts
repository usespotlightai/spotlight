import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceInviteAccepted implements DomainEvent {
  readonly kind = 'workspace-invite.accepted';

  constructor(
    readonly inviteId: InviteId,
    readonly workspaceId: WorkspaceId,
    readonly spec: InviteSpec,
    readonly userId: UserId,
  ) {}
}
