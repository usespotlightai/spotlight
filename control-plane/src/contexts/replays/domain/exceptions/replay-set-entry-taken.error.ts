import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplaySetEntryTakenError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: string) {
    super(`Run ${runId} or its task is in the replay set already.`);
    this.name = 'ReplaySetEntryTakenError';
  }
}
