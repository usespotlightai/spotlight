import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface VerificationSendRepository {
  countOfUserSince(userId: UserId, since: Date): Promise<number>;

  record(userId: UserId, at: Date): Promise<void>;
}
