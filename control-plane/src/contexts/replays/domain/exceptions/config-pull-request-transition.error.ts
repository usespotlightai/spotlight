import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ConfigPullRequestTransitionError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(
    pullRequestId: string,
    current: string,
    wanted: readonly string[],
  ) {
    super(
      `Config pull request ${pullRequestId} is ${current}, not ${wanted.join(' or ')}.`,
    );
    this.name = 'ConfigPullRequestTransitionError';
  }
}
