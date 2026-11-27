import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

export class SecretAwaitingValue implements RefusalReason {
  readonly code = 'secret_awaiting_value';

  private constructor(readonly secret: SecretName) {}

  static of(secret: SecretName): SecretAwaitingValue {
    return new SecretAwaitingValue(secret);
  }

  get description(): string {
    return `Secret ${this.secret.value} has no value yet. Set it on the Secrets settings page.`;
  }
}
