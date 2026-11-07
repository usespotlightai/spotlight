import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownRunnerError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(runnerId: string) {
    super(`Runner ${runnerId} not found.`);
    this.name = 'UnknownRunnerError';
  }
}
