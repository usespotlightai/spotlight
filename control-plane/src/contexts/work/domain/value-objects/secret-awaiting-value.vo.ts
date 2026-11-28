import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class SecretAwaitingValue {
  readonly code = 'secret_awaiting_value';

  private constructor(readonly secret: SecretName) {}

  static of(secret: SecretName): SecretAwaitingValue {
    return new SecretAwaitingValue(secret);
  }
}
