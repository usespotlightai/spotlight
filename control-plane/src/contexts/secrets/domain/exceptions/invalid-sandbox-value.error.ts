import { sandboxValueRule } from '@secrets/domain/value-objects/secret-sandbox.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidSandboxValueError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(
      `The value of secret ${secretName} ${sandboxValueRule(secretName)}. Set a new value.`,
    );
    this.name = 'InvalidSandboxValueError';
  }
}
