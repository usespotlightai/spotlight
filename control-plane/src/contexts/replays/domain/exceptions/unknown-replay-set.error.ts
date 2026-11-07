import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReplaySetError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(setId: string) {
    super(`Replay set ${setId} not found.`);
    this.name = 'UnknownReplaySetError';
  }
}
