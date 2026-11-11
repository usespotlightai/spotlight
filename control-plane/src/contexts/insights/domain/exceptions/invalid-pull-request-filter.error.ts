import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPullRequestFilterError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Pull request filter ${reason}.`);
    this.name = 'InvalidPullRequestFilterError';
  }
}
