import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class PushDiffNotLeasedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: PushDiffId) {
    super(`Push diff ${id.value} is not being made by this runner.`);
    this.name = 'PushDiffNotLeasedError';
  }
}
