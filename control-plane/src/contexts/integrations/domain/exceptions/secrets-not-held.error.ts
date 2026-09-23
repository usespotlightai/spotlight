import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class SecretsNotHeldError extends Error {
  readonly violation = 'conflict' as const;

  constructor(source: string, names: readonly SecretName[]) {
    super(
      `The ${source} integration reads ${names.map((each) => `secret.${each.value}`).join(', ')}, which the team does not hold`,
    );
    this.name = 'SecretsNotHeldError';
  }
}
