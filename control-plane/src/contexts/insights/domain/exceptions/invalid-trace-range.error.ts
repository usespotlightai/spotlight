import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTraceRangeError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(names: readonly string[]) {
    super(`Range must be one of ${names.join(', ')}.`);
    this.name = 'InvalidTraceRangeError';
  }
}
