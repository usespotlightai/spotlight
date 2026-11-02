import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class UserEmailVerified implements DomainEvent {
  readonly kind = 'user-email.verified';

  constructor(
    readonly userEmailId: UserEmailId,
    readonly userId: UserId,
    readonly email: EmailAddress,
  ) {}
}
