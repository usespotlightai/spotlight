import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidFingerprintError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(subject: string) {
    super(`A ${subject} must be 64 hex characters.`);
    this.name = 'InvalidFingerprintError';
  }
}
