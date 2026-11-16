import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PushDiffVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: PushDiffId) {
    super(
      `Push diff ${id.toString()} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'PushDiffVersionConflictError';
  }
}
