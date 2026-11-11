import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class StackCheckVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: StackCheckId) {
    super(
      `Change stack ${id.toString()} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'StackCheckVersionConflictError';
  }
}
