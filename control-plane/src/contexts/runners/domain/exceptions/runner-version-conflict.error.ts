import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `Runner ${runnerId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerVersionConflictError';
  }
}
