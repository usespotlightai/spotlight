import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownReplaySetEntryError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(runId: string) {
    super(`Run ${runId} is not in the replay set.`);
    this.name = 'UnknownReplaySetEntryError';
  }
}
