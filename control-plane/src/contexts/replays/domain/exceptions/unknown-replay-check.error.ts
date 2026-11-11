import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReplayCheckError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(checkId: string) {
    super(`Replay check ${checkId} not found.`);
    this.name = 'UnknownReplayCheckError';
  }
}
