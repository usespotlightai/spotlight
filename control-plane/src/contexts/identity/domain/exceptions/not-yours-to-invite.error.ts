import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotYoursToInviteError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor() {
    super(
      'Nobody can be invited as an owner. Please invite them as an admin, then make them an owner.',
    );
    this.name = 'NotYoursToInviteError';
  }
}
