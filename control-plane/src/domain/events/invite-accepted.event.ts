import type { DomainEvent } from '@domain/events/domain-event';
import type { InviteId } from '@domain/value-objects/invite-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamRole } from '@domain/value-objects/team-role.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class InviteAccepted implements DomainEvent {
  readonly kind = 'invite.accepted';

  constructor(
    readonly inviteId: InviteId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly userId: UserId,
    readonly role: TeamRole,
  ) {}
}
