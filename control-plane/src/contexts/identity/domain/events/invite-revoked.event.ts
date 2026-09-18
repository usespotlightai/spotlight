import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class InviteRevoked implements DomainEvent {
  readonly kind = 'invite.revoked';

  constructor(
    readonly inviteId: InviteId,
    readonly teamId: TeamId,
    readonly email: EmailAddress,
  ) {}
}
