import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class WorkNotLeasedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(workId: string) {
    super(`This runner does not hold the lease on ${workId}.`);
    this.name = 'WorkNotLeasedError';
  }
}
