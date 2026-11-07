import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnreviewablePullRequestError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(url: string) {
    super(`Pull request ${url} has no head to check out.`);
    this.name = 'UnreviewablePullRequestError';
  }
}
