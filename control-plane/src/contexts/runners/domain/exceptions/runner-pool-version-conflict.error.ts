import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerPoolVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(poolId: string) {
    super(
      `Runner pool ${poolId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerPoolVersionConflictError';
  }
}
