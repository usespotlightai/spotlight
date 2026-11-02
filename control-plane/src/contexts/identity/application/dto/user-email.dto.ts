import type { UserEmailStatus } from '@identity/domain/aggregates/user-email.aggregate';

export interface UserEmailDto {
  readonly id: string;
  readonly email: string;
  readonly status: UserEmailStatus;
  readonly addedAt: string;
  readonly sentAt: string;
}

export interface UserEmailsDto {
  readonly signInEmail: string;
  readonly additional: readonly UserEmailDto[];
}
