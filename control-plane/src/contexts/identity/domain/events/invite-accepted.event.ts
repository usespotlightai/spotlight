import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class InviteAccepted implements DomainEvent {
  readonly kind = 'invite.accepted';

  constructor(
    readonly inviteId: InviteId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly userId: UserId,
  ) {}
}
