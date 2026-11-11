import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class StackCheckNotLeasedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: StackCheckId) {
    super(`Change stack ${id} is not being checked by this runner.`);
    this.name = 'StackCheckNotLeasedError';
  }
}
