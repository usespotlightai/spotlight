import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

export class UntrialableRunError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    readonly runId: string,
    readonly untrialableReason: UntrialableReason,
    readonly description: string,
  ) {
    super(`Run ${runId} cannot be tried again. ${description}`);
    this.name = 'UntrialableRunError';
  }
}
