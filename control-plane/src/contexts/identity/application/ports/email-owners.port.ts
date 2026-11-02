import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const EMAIL_OWNERS = Symbol('EMAIL_OWNERS');

export interface EmailOwnersPort {
  ownerOf(email: EmailAddress): Promise<UserId | null>;
}
