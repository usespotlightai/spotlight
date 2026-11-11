import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunnerAlreadyClaimedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runnerId: string) {
    super(`Runner ${runnerId} has already claimed its one piece of work.`);
    this.name = 'RunnerAlreadyClaimedError';
  }
}
