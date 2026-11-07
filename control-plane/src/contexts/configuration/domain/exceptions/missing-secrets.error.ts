import type { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class MissingSecretsError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly missing: readonly SecretReference[],
  ) {
    super(
      `Harness profile ${key} uses secrets the workspace does not have. Missing secrets: ${missing.map((each) => each.name.value).join(', ')}`,
    );
    this.name = 'MissingSecretsError';
  }
}
