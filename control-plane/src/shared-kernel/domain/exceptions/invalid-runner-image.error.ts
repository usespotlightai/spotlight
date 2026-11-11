import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidRunnerImageError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Runner image ${because}.`);
    this.name = 'InvalidRunnerImageError';
  }
}
