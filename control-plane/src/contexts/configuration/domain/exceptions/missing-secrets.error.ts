import type { WornSecret } from '@configuration/domain/value-objects/profile-settings.vo';

export class MissingSecretsError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly missing: readonly WornSecret[],
  ) {
    super(
      `Harness profile ${key} uses secrets the workspace does not have. Missing secrets: ${missing.map((each) => each.secret.value).join(', ')}`,
    );
    this.name = 'MissingSecretsError';
  }
}
