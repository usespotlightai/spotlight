import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UserEmailVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(userEmailId: string) {
    super(
      `Email ${userEmailId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'UserEmailVersionConflictError';
  }
}
