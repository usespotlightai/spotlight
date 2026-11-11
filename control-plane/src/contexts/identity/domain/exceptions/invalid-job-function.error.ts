import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidJobFunctionError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string, valid: readonly string[]) {
    super(
      `Job function ${raw} does not exist. Valid job functions: ${valid.join(', ')}`,
    );
    this.name = 'InvalidJobFunctionError';
  }
}
