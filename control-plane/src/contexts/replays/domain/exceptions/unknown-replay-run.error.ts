import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReplayRunError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`Replay run ${runId} not found.`);
    this.name = 'UnknownReplayRunError';
  }
}
