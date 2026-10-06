import type { WornSecret } from '@configuration/domain/value-objects/profile-settings.vo';

export class SecretsUnheldError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly unheld: readonly WornSecret[],
  ) {
    super(
      `Harness profile ${key} uses secrets the workspace does not hold. Missing secrets: ${unheld.map((each) => each.secret.value).join(', ')}`,
    );
    this.name = 'SecretsUnheldError';
  }
}
