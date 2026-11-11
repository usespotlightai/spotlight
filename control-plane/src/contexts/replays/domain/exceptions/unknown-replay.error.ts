import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReplayError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(replayId: string) {
    super(`Replay ${replayId} not found.`);
    this.name = 'UnknownReplayError';
  }
}
