import type { SecretReferenceAt } from '@configuration/domain/value-objects/secret-reference-at.vo';

export class MissingSecretsError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly missing: readonly SecretReferenceAt[],
  ) {
    super(
      `Harness profile ${key} uses secrets the workspace does not have. Missing secrets: ${missing.map((each) => each.name).join(', ')}`,
    );
    this.name = 'MissingSecretsError';
  }
}
