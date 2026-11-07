import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnreplayableEntryError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    readonly runId: string,
    readonly unreplayableReason: UnreplayableReason,
    reason: string,
  ) {
    super(`Run ${runId} cannot be replayed. ${reason}`);
    this.name = 'UnreplayableEntryError';
  }
}
