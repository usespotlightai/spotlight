import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ReplayRunClaimVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(runId: RunId) {
    super(
      `The claim on replay run ${runId.value} changed since it was loaded. Please try again.`,
    );
    this.name = 'ReplayRunClaimVersionConflictError';
  }
}
