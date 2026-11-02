import type { UserEmailStatus } from '@identity/domain/aggregates/user-email.aggregate';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const USER_EMAIL_READER = Symbol('USER_EMAIL_READER');

export interface UserEmailSummary {
  readonly id: string;
  readonly email: string;
  readonly status: UserEmailStatus;
  readonly addedAt: Date;
  readonly sentAt: Date;
}

export interface UserEmailReaderPort {
  ofUser(userId: UserId, now: Date): Promise<readonly UserEmailSummary[]>;
}
