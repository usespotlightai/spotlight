import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidActionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly at: FieldPath,
    readonly because: string,
  ) {
    super(`Action ${at.rendered} ${because}.`);
    this.name = 'InvalidActionError';
  }
}
