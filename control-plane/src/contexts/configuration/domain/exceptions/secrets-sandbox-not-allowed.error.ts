import type { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretsSandboxNotAllowedError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly refused: readonly SecretReference[],
  ) {
    super(
      `Harness profile ${key} puts secrets in the sandbox that do not allow it: ${refused.map((each) => each.name.value).join(', ')}`,
    );
    this.name = 'SecretsSandboxNotAllowedError';
  }
}
