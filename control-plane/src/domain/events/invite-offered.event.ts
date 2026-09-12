import type { DomainEvent } from '@domain/events/domain-event';
import type { EmailAddress } from '@domain/value-objects/email-address.vo';
import type { InviteId } from '@domain/value-objects/invite-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export class InviteOffered implements DomainEvent {
  readonly kind = 'invite.offered';

  constructor(
    readonly inviteId: InviteId,
    readonly teamId: TeamId,
    readonly email: EmailAddress,
    readonly invitedBy: UserId,
    readonly again: boolean,
  ) {}
}
