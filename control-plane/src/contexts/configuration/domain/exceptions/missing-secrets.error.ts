import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class MissingSecretsError extends Error {
  readonly violation = 'invalid' as const;

  constructor(names: readonly SecretName[]) {
    super(
      `These integrations need ${names.map((each) => each.value).join(', ')}: give each a value`,
    );
    this.name = 'MissingSecretsError';
  }
}
