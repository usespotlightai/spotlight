import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidCommitShaError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(`"${raw}" is not a commit id: a commit id is 40 or 64 hex digits.`);
    this.name = 'InvalidCommitShaError';
  }
}
