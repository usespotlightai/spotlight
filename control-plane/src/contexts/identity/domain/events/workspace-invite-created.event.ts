import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceInviteCreated implements DomainEvent {
  readonly kind = 'workspace-invite.created';

  constructor(
    readonly inviteId: InviteId,
    readonly workspaceId: WorkspaceId,
    readonly email: EmailAddress,
    readonly terms: InviteTerms,
    readonly invitedBy: UserId,
    readonly resent: boolean,
  ) {}
}
