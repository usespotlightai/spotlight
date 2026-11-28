import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidHookError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly at: FieldPath,
    readonly because: string,
    message = `Hook ${at.rendered} ${because}.`,
  ) {
    super(message);
    this.name = 'InvalidHookError';
  }

  static naming(
    at: FieldPath,
    refusal: InvalidIdentifierError,
  ): InvalidHookError {
    return new InvalidHookError(
      at,
      refusal.because,
      `Hook ${at.rendered}: ${refusal.message}`,
    );
  }
}
