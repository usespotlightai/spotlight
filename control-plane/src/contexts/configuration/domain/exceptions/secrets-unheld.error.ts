import type { WornSecret } from '@configuration/domain/value-objects/profile-settings.vo';

export class SecretsUnheldError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly unheld: readonly WornSecret[],
  ) {
    super(
      `The ${key} harness profile names secrets the workspace does not hold: ${unheld.map((each) => each.secret.value).join(', ')}`,
    );
    this.name = 'SecretsUnheldError';
  }
}
