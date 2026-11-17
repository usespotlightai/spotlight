import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownPushDiffError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(id: PushDiffId) {
    super(`Push diff ${id.value} not found.`);
    this.name = 'UnknownPushDiffError';
  }
}
