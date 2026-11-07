import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownRunError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`Run ${runId} not found.`);
    this.name = 'UnknownRunError';
  }
}
