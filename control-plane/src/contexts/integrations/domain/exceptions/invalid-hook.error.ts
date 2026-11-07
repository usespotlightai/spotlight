import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidHookError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly at: FieldPath,
    readonly because: string,
  ) {
    super(`Hook ${at.rendered} ${because}.`);
    this.name = 'InvalidHookError';
  }
}
