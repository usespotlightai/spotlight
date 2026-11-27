import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class SecretSandboxNotAllowed {
  readonly code = 'secret_sandbox_not_allowed';

  private constructor(readonly secret: SecretName) {}

  static of(secret: SecretName): SecretSandboxNotAllowed {
    return new SecretSandboxNotAllowed(secret);
  }
}
