import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownSearchRunError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`No search ran ${runId}`);
    this.name = 'UnknownSearchRunError';
  }
}
