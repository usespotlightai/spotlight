import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPullRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Pull request ${reason}.`);
    this.name = 'InvalidPullRequestError';
  }
}
