import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretTooShortForSandboxError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    readonly secretName: string,
    readonly shortest: number,
  ) {
    super(
      `Secret ${secretName} is shorter than ${shortest} characters. Spotlight cannot replace a value that short with its stand-in in what a run records. Use a longer value.`,
    );
    this.name = 'SecretTooShortForSandboxError';
  }
}
