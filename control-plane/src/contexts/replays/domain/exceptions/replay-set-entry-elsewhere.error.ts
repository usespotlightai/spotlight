import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplaySetEntryElsewhereError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(runId: string) {
    super(`Run ${runId} worked at a different station from the replay set.`);
    this.name = 'ReplaySetEntryElsewhereError';
  }
}
