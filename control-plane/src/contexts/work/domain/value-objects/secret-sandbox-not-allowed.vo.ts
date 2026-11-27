import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';

export class SecretSandboxNotAllowed implements RefusalReason {
  readonly code = 'secret_sandbox_not_allowed';

  private constructor(readonly secret: SecretName) {}

  static of(secret: SecretName): SecretSandboxNotAllowed {
    return new SecretSandboxNotAllowed(secret);
  }

  get description(): string {
    return `Secret ${this.secret.value} does not allow its value in a sandbox. Set sandbox = "env" on the secret.`;
  }
}
