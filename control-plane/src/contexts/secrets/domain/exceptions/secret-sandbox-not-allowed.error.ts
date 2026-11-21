import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretSandboxNotAllowedError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(
      `Secret ${secretName} does not allow its value in a sandbox. Set sandbox = "env" on the secret.`,
    );
    this.name = 'SecretSandboxNotAllowedError';
  }
}
