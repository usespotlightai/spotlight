import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunAttemptError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reported: number) {
    super(
      `Attempt ${reported} names no attempt. An attempt is a whole number from 1.`,
    );
    this.name = 'InvalidRunAttemptError';
  }
}
