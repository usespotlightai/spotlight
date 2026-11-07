import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunGrantsVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(
      `Secret grants for run ${runId} changed since they were loaded. Please try again.`,
    );
    this.name = 'RunGrantsVersionConflictError';
  }
}
