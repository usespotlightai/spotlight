import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ConfigPullRequestVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(pullRequestId: string) {
    super(
      `Config pull request ${pullRequestId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ConfigPullRequestVersionConflictError';
  }
}
