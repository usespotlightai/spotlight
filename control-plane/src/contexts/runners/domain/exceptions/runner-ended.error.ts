import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerEndedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runnerId: string) {
    super(`Runner ${runnerId} ended, or its time to claim work passed.`);
    this.name = 'RunnerEndedError';
  }
}
