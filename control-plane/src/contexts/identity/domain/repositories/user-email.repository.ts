import type { UserEmail } from '@identity/domain/aggregates/user-email.aggregate';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import type { UserEmailId } from '@identity/domain/value-objects/user-email-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface UserEmailRepository {
  add(added: UserEmail): Promise<void>;

  save(saved: UserEmail): Promise<void>;

  remove(removed: UserEmail): Promise<void>;

  countOfUser(userId: UserId): Promise<number>;

  ofUser(userId: UserId, id: UserEmailId): Promise<UserEmail | null>;

  ofUserByAddress(
    userId: UserId,
    email: EmailAddress,
  ): Promise<UserEmail | null>;

  withToken(hash: TokenHash): Promise<UserEmail | null>;
}
