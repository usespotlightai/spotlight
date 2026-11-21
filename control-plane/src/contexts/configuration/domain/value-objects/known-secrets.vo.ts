import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class KnownSecrets {
  private constructor(
    readonly existing: readonly SecretName[],
    readonly sandboxSecrets: readonly SecretName[],
  ) {}

  static of(input: {
    existing: readonly SecretName[];
    sandboxSecrets: readonly SecretName[];
  }): KnownSecrets {
    return new KnownSecrets(
      Object.freeze([...input.existing]),
      Object.freeze([...input.sandboxSecrets]),
    );
  }
}
