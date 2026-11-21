import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class KnownSecrets {
  private constructor(
    readonly existing: readonly SecretName[],
    readonly allowedInSandbox: readonly SecretName[],
  ) {}

  static of(input: {
    existing: readonly SecretName[];
    allowedInSandbox: readonly SecretName[];
  }): KnownSecrets {
    return new KnownSecrets(
      Object.freeze([...input.existing]),
      Object.freeze([...input.allowedInSandbox]),
    );
  }
}
