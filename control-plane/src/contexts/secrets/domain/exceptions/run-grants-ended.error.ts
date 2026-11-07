import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class RunGrantsEndedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(runId: string) {
    super(`Run ${runId} has ended. It can receive no more secrets.`);
    this.name = 'RunGrantsEndedError';
  }
}
