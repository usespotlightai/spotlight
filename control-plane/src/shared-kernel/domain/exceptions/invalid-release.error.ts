import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReleaseError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Release ${because}.`);
    this.name = 'InvalidReleaseError';
  }
}
