import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class AlreadyInvitedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(email: string) {
    super(
      `An invite to ${email} was just sent for this workspace. Please try again.`,
    );
    this.name = 'AlreadyInvitedError';
  }
}
