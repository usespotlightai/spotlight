import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidPullRequestTitleError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(because: string) {
    super(`Pull request title ${because}.`);
    this.name = 'InvalidPullRequestTitleError';
  }
}
